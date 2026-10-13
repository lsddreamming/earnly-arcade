-- Retain the exact offered IDs even if an item is removed before confirmation.
-- world_trade_action compares the immutable offer count with existing owned items;
-- cascading deletion would silently shrink a previously locked offer.
alter table earnly_world.trade_items drop constraint trade_items_item_id_fkey;
-- Transfer audit evidence likewise survives removal of an item instance.
alter table earnly_world.item_history drop constraint item_history_item_id_fkey;
