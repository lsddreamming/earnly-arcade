"""Exercise financial locking across real PostgreSQL sessions in the isolated CI database."""
import concurrent.futures
import os
import pathlib
import subprocess
import uuid

if os.environ.get("PGHOST") != "127.0.0.1" or os.environ.get("PGDATABASE") != "studio_contract_test":
    raise SystemExit("An isolated local studio_contract_test database is required.")

def sql(statement, check=True):
    return subprocess.run(["psql", "-XAtq", "-v", "ON_ERROR_STOP=1", "-c", statement],
                          capture_output=True, text=True, check=check)

def load(path):
    subprocess.run(["psql", "-Xq", "-v", "ON_ERROR_STOP=1", "-f", str(path)], check=True)

load("tests/commerce-fixture.sql")
sql("create role service_role bypassrls; create schema storage; create table storage.buckets(id text primary key, name text, public boolean,file_size_limit bigint,allowed_mime_types text[])")
for migration in sorted(pathlib.Path("supabase/migrations").glob("*earnly_studio*.sql")):
    load(migration)
uid = "00000000-0000-4000-8000-000000000001"
sql(f"insert into studio_accounts(user_id,pilot,credits) values('{uid}',true,100);update studio_control set enabled=true,quote_expires=now()+interval '1 day',daily_limit=60000,user_jobs=50,concurrent_jobs=8")

def reserve(request):
    return sql(f"select studio_reserve('{uid}','{request}','video','A smiling potato','9:16')", check=False)

with concurrent.futures.ThreadPoolExecutor(max_workers=12) as pool:
    duplicate = list(pool.map(reserve, [uuid.uuid4()] * 12))
    assert all(job.returncode == 0 for job in duplicate)
    assert len({job.stdout for job in duplicate}) == 1
    competing = list(pool.map(reserve, [uuid.uuid4() for _ in range(18)]))
    assert sum(job.returncode == 0 for job in competing) == 1
    assert all(job.returncode == 0 or "STUDIO_LIMIT" in job.stderr for job in competing)
    sql("update studio_jobs set state='queued'")
    claims = list(pool.map(lambda _:sql("select id from studio_claim()").stdout.strip(), range(12)))
    assert len([job for job in claims if job]) == len(set(job for job in claims if job)) == 2
assert sql("select count(*),sum(reserved_usd_micro) from studio_jobs").stdout.strip() == "2|60000"
assert sql("select credits from studio_accounts").stdout.strip() == "80"
assert sql("select public from storage.buckets where id='studio-private'").stdout.strip() == "f"
print("PASS: concurrent duplicate submissions, competing budget reservations, two exclusive worker claims, private bucket, and consistent wallet totals.")
