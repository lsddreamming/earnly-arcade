-- Replace only game formulas; preserve auth, ledger, daily limits and challenge rewards.
DO $migration$
DECLARE original text; updated text; first_pos integer; last_pos integer;
BEGIN
 SELECT pg_get_functiondef('public.claim_coin_reward(text,text,text,integer,integer,text,text)'::regprocedure) INTO original;
 first_pos:=position('    case v_game' in original);
 last_pos:=position('    v_source_type := ''game'';' in original);
 IF first_pos=0 OR last_pos<=first_pos THEN RAISE EXCEPTION 'Reward function changed; review migration'; END IF;
 updated:=substr(original,1,first_pos-1)||$rules$    case v_game
      when 'snake' then
        v_amount := least(100,(floor(v_metric/3.0)+(case when v_metric>=10 then 2 else 0 end)+(case when v_metric>=25 then 3 else 0 end)+(case when v_metric>=50 then 4 else 0 end))*3)::integer;
      when 'blockDrop' then
        v_amount := least(100,(v_metric*3+(case when v_metric>=5 then 5 else 0 end)+(case when v_metric>=10 then 10 else 0 end)+(case when v_metric>=20 then 15 else 0 end))*1)::integer;
      when 'tapRush' then
        v_amount := least(60,(floor(v_metric/5.0)+(case when v_metric>=20 then 2 else 0 end)+(case when v_metric>=35 then 3 else 0 end)+(case when v_metric>=50 then 5 else 0 end)+least(v_aux,v_metric))*3)::integer;
      when 'memory' then
        if v_metric<1 then raise exception 'Invalid memory result';end if;
        v_amount := least(60,(8+(case when v_metric<=16 then 7 when v_metric<=20 then 5 when v_metric<=24 then 3 when v_metric<=30 then 1 else 0 end))*4)::integer;
      when 'dodger' then
        v_amount := least(80,(floor(v_metric/6.0)+floor(v_aux/12.0)+(case when v_metric>=20 then 1 else 0 end)+(case when v_metric>=40 then 2 else 0 end)+(case when v_metric>=60 then 3 else 0 end))*4)::integer;
      when 'jungleHopper' then
        v_amount := least(100,(floor(v_metric/2.0)+(case when v_metric>=10 then 2 else 0 end)+(case when v_metric>=20 then 3 else 0 end)+(case when v_metric>=30 then 5 else 0 end)+least(v_aux,floor((v_metric+1)/2.0)+floor((v_metric+1)/6.0),25))*4)::integer;
      when 'towerStack' then
        v_amount := least(100,(floor(v_metric/3.0)+floor(least(v_aux,v_metric)/3.0)+(case when v_metric>=10 then 2 else 0 end)+(case when v_metric>=20 then 3 else 0 end)+(case when v_metric>=30 then 5 else 0 end))*4)::integer;
      when 'coinCatch' then
        v_amount := least(100,((case when v_metric>=6 then 1+floor((v_metric-6)/12.0) else 0 end)+(case when v_metric>=75 then 1 else 0 end)+(case when v_metric>=150 then 1 else 0 end)+(case when v_metric>=225 then 1 else 0 end))*4)::integer;
      when 'colorMatch' then
        v_amount := least(88,(floor(v_metric/4.0)+(case when v_metric>=15 then 2 else 0 end)+(case when v_metric>=25 then 3 else 0 end)+(case when v_metric>=35 then 4 else 0 end))*4)::integer;
      when 'paddleRally' then
        v_amount := least(100,(floor(v_metric/3.0)+(case when v_metric>=10 then 2 else 0 end)+(case when v_metric>=20 then 3 else 0 end)+(case when v_metric>=35 then 5 else 0 end))*4)::integer;
      when 'laneRunner' then
        v_amount := least(100,(floor(v_metric/8.0)+floor(v_aux/14.0)+(case when v_metric>=30 then 2 else 0 end)+(case when v_metric>=60 then 3 else 0 end)+(case when v_metric>=90 then 4 else 0 end))*3)::integer;
      when 'safeCracker' then
        v_amount := least(100,(floor(v_metric/2.0)+(case when v_metric>=8 then 2 else 0 end)+(case when v_metric>=15 then 4 else 0 end)+(case when v_metric>=25 then 5 else 0 end))*4)::integer;
      when 'blockGrid' then
        v_amount := least(100,(floor(v_metric/40.0)+(case when v_metric>=250 then 3 else 0 end)+(case when v_metric>=500 then 5 else 0 end))*4)::integer;
      when 'mergeRush' then
        v_amount := least(100,((case when v_metric>=50 then greatest(1,floor(v_metric/100.0)) else 0 end)+(case when v_metric>=500 then 2 else 0 end)+(case when v_metric>=1000 then 3 else 0 end)+(case when v_metric>=2500 then 5 else 0 end))*4)::integer;
      when 'perfectDrop' then
        v_amount := least(100,(ceil(v_metric/3.0)+(case when v_metric>=5 then 1 else 0 end)+(case when v_metric>=10 then 2 else 0 end)+(case when v_metric>=15 then 3 else 0 end)+(case when v_metric>=20 then 5 else 0 end))*4)::integer;
      when 'spiralDrop' then
        v_amount := least(100,((case when v_metric>=5 then 1 else 0 end)+(case when v_metric>=10 then 1 else 0 end)+(case when v_metric>=15 then 1 else 0 end)+(case when v_metric>=20 then 2 else 0 end)+(case when v_metric>=30 then 2 else 0 end)+(case when v_metric>=40 then 3 else 0 end)+(case when v_metric>=50 then 3 else 0 end)+(case when v_metric>=60 then 3 else 0 end)+(case when v_metric>=70 then 3 else 0 end)+(case when v_metric>=85 then 3 else 0 end)+(case when v_metric>=100 then 3 else 0 end))*4)::integer;
      when 'shapeFit' then
        v_amount := least(100,(floor(v_metric/3.0)+(case when v_metric>=15 then 3 else 0 end)+(case when v_metric>=30 then 5 else 0 end)+(case when v_metric>=50 then 5 else 0 end))*4)::integer;
      when 'bounceRun' then
        v_amount := least(100,(floor(v_metric/80.0)+(case when v_metric>=500 then 2 else 0 end)+(case when v_metric>=900 then 3 else 0 end)+(case when v_metric>=1400 then 4 else 0 end)+(case when v_metric>=1900 then 5 else 0 end))*4)::integer;
      when 'trafficEscape' then
        v_amount := least(100,(floor(v_metric/9.0)+(case when v_metric>=30 then 1 else 0 end)+(case when v_metric>=60 then 2 else 0 end)+(case when v_metric>=100 then 3 else 0 end)+(case when v_metric>=150 then 4 else 0 end)+(case when v_metric>=210 then 5 else 0 end))*3)::integer;
      when 'neonMaze' then
        v_amount := least(100,(floor(v_metric/6.0))*4)::integer;
      when 'starDefender' then
        v_amount := least(60,(floor(v_metric/80.0))*4)::integer;
      when 'neonBreach' then
        v_amount := least(100,(floor(v_metric/150.0))*4)::integer;
      when 'neonDrift' then
        v_amount := least(90,(least(floor(v_metric/100.0),25)+least(v_aux,20))*2)::integer;
      when 'crystalCommand' then
        if v_metric<1 or v_aux<60 then raise exception 'Invalid battle result';end if;
        v_amount := least(100,(10+least(15,floor(v_metric/3.0)))*4)::integer;
      when 'brickBreaker' then
        v_amount:=floor(v_metric/12.0)::integer+case when v_metric>=50 then 1 else 0 end+case when v_metric>=100 then 1 else 0 end;
        for v_i in 1..least(v_aux,100) loop
          v_amount:=v_amount+(array[2,3,3,4,4,5,5,6,6,7,7,8])[least(v_i,12)];
        end loop;
        v_amount:=least(v_amount,100);
      when 'turboKart' then
        if v_metric<1 or v_metric>5 then raise exception 'Invalid kart result';end if;
        v_amount:=case v_metric when 1 then 20 when 2 then 15 when 3 then 12 when 4 then 9 else 7 end+least(v_aux,5);
      else raise exception 'Unknown game';
    end case;

$rules$||substr(original,last_pos);
 EXECUTE updated;
END $migration$;

-- New aspirational items only: existing furniture prices and ownership remain intact.
INSERT INTO earnly_world.item_definitions(id,name,sprite_id,item_height,price,width,length,can_sit,can_lay,can_stack,walkable,category,color) VALUES
('prism-beacon','Prism Beacon','premium-beacon',1.5,750,2,2,false,false,false,false,'Signature Collection','#70e6d4'),
('celestial-gateway','Celestial Gateway','premium-gateway',1.5,1250,2,2,false,false,false,false,'Signature Collection','#9b8eea'),
('aurora-pavilion','Aurora Pavilion','premium-pavilion',1.5,2000,2,2,false,false,false,false,'Signature Collection','#79cfd6')
on conflict(id) do nothing;
