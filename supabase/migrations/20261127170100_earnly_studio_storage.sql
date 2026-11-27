insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('studio-private','studio-private',false,33554432,array['image/jpeg','video/mp4'])
on conflict(id) do nothing;
