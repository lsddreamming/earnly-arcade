import StoreKit

// Registered by the app's bridge. Transactions finish only after server delivery.
class EarnlyBridgeViewController: CAPBridgeViewController {
    override func capacitorDidLoad() { bridge?.registerPluginInstance(ArcadePurchasesPlugin()) }
}

@objc(ArcadePurchasesPlugin)
public class ArcadePurchasesPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "ArcadePurchasesPlugin"
    public let jsName = "ArcadePurchases"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "products", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "purchase", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "pending", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "finish", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "restore", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "manage", returnType: CAPPluginReturnPromise)
    ]
    private let ids = ["com.earnly.arcade.coins.starter", "com.earnly.arcade.coins.plus", "com.earnly.arcade.coins.vault", "com.earnly.arcade.vip.monthly"]
    private var updates: Task<Void, Never>?
    public override func load() {
        updates = Task { [weak self] in
            for await result in Transaction.updates {
                if case .verified = result {
                    self?.notifyListeners("transaction", data: ["signedTransaction": result.jwsRepresentation], retainUntilConsumed: true)
                }
            }
        }
    }
    deinit { updates?.cancel() }
    @objc func products(_ call: CAPPluginCall) {
        Task {
            do {
                let products = try await Product.products(for: ids)
                call.resolve(["products": products.filter { $0.type == .consumable || $0.type == .autoRenewable }.map { ["id": $0.id, "displayPrice": $0.displayPrice] }])
            } catch { call.reject("Apple prices are unavailable. Try again shortly.") }
        }
    }
    @objc func purchase(_ call: CAPPluginCall) {
        guard let id = call.getString("productId"), ids.contains(id),
              let account = call.getString("accountToken"), let token = UUID(uuidString: account) else {
            call.reject("Sign in and choose a valid coin pack."); return
        }
        Task {
            do {
                guard let product = try await Product.products(for: [id]).first, (product.type == .consumable || product.type == .autoRenewable) else {
                    call.reject("This coin pack is unavailable."); return
                }
                switch try await product.purchase(options: [.appAccountToken(token)]) {
                case .success(let result):
                    guard case .verified = result else { call.reject("Apple could not verify this purchase."); return }
                    call.resolve(["status": "purchased", "signedTransaction": result.jwsRepresentation])
                case .pending: call.resolve(["status": "pending"])
                case .userCancelled: call.resolve(["status": "cancelled"])
                @unknown default: call.reject("Purchase status is unknown. Reopen the shop to check.")
                }
            } catch { call.reject("Purchase could not complete. Reopen the shop to check pending purchases.") }
        }
    }
    @objc func pending(_ call: CAPPluginCall) {
        Task {
            var transactions: [String] = []
            for await result in Transaction.unfinished {
                if case .verified = result { transactions.append(result.jwsRepresentation) }
            }
            call.resolve(["transactions": transactions])
        }
    }
    @objc func restore(_ call: CAPPluginCall) {
        Task {
            do {
                try await AppStore.sync()
                var transactions: [String] = []
                for await result in Transaction.currentEntitlements {
                    if case .verified(let transaction) = result, transaction.productID == "com.earnly.arcade.vip.monthly" {
                        transactions.append(result.jwsRepresentation)
                    }
                }
                call.resolve(["transactions": transactions])
            } catch { call.reject("Restore could not complete. Please try again.") }
        }
    }
    @objc func manage(_ call: CAPPluginCall) {
        Task { @MainActor in
            guard let scene = self.bridge?.viewController?.view.window?.windowScene else { call.reject("Subscription settings unavailable."); return }
            do { try await AppStore.showManageSubscriptions(in: scene); call.resolve() }
            catch { call.reject("Could not open subscription settings.") }
        }
    }
    @objc func finish(_ call: CAPPluginCall) {
        guard let id = call.getString("transactionId") else { call.reject("Missing transaction."); return }
        Task {
            for await result in Transaction.unfinished {
                if case .verified(let transaction) = result, String(transaction.id) == id {
                    await transaction.finish(); break
                }
            }
            call.resolve()
        }
    }
}
