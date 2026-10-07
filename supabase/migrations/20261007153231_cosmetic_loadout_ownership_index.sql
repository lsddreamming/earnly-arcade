-- Covers the inventory ownership foreign key when a user/item is removed.
CREATE INDEX IF NOT EXISTS cosmetic_loadouts_owned_item_idx ON public.cosmetic_loadouts(user_id,item_id);
