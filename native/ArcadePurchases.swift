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
    private var studioIds: [String] {
        #if EARNLY_STUDIO_SANDBOX
        return ["com.earnly.arcade.studio.premium.monthly", "com.earnly.arcade.studio.pro.monthly", "com.earnly.arcade.studio.credits100"]
        #else
        return []
        #endif
    }
    private func studioSandboxAvailable() async -> Bool {
        guard !studioIds.isEmpty else { return false }
        if #available(iOS 16.0, *) {
            guard let result = try? await AppTransaction.shared,
                  case .verified(let app) = result else { return false }
            return app.environment == .sandbox
        }
        return false
    }
    private var updates: Task<Void, Never>?
    public override func load() {
        updates = Task { [weak self] in
            for await result in Transaction.updates {
                if case .verified(let transaction) = result {
                    let event = self?.studioIds.contains(transaction.productID) == true ? "studioTransaction" : "transaction"
                    self?.notifyListeners(event, data: ["signedTransaction": result.jwsRepresentation], retainUntilConsumed: true)
                }
            }
        }
    }
    deinit { updates?.cancel() }
    @objc func products(_ call: CAPPluginCall) {
        Task {
            do {
                let studio = call.getString("store") == "studio"
                if studio {
                    guard await studioSandboxAvailable() else { call.resolve(["products": []]); return }
                }
                let products = try await Product.products(for: studio ? studioIds : ids)
                call.resolve(["products": products.filter { $0.type == .consumable || $0.type == .autoRenewable }.map { ["id": $0.id, "displayPrice": $0.displayPrice] }])
            } catch { call.reject("Apple prices are unavailable. Try again shortly.") }
        }
    }
    @objc func purchase(_ call: CAPPluginCall) {
        guard let id = call.getString("productId"), (ids.contains(id) || studioIds.contains(id)),
              let account = call.getString("accountToken"), let token = UUID(uuidString: account) else {
            call.reject("Sign in and choose a valid coin pack."); return
        }
        Task {
            do {
                if studioIds.contains(id) {
                    guard await studioSandboxAvailable() else { call.reject("Studio sandbox is unavailable."); return }
                }
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
                if case .verified(let transaction) = result, studioIds.contains(transaction.productID) == (call.getString("store") == "studio") { transactions.append(result.jwsRepresentation) }
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
                    if case .verified(let transaction) = result, (call.getString("store") == "studio" ? studioIds.contains(transaction.productID) : transaction.productID == "com.earnly.arcade.vip.monthly") {
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
