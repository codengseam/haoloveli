/* =========================================================================
   haoloveli · 爱的小窝 · Supabase 数据库初始化脚本
   =========================================================================
   【使用方式】
   1. 登录 https://supabase.com 新建一个项目（Region 选 ap-southeast-1（新加坡）或 ap-northeast-1（东京），延迟低）
   2. 左侧菜单 → SQL Editor → New query
   3. 把本文件从第 1 行到最后一行完整粘贴进去，点 ▶ Run
   4. 左侧菜单 → Table Editor，确认 9 张表（couples + 8 张业务表）都建好了
   5. 左侧菜单 → Project Settings → API，复制 Project URL 和 anon public key（service_role key 千万别复制到前端！）
      填到 shared/config.js 里的 LOVENEST_SUPABASE_URL / LOVENEST_SUPABASE_ANON_KEY
   ========================================================================= */

-- ---------- 0. 启用扩展 ----------
create extension if not exists "moddatetime";  -- updated_at 自动触发器
create extension if not exists "pgcrypto";     -- gen_random_uuid()

-- ---------- 1. 主表：couples（一对情侣 / 一个小家庭一行）----------
create table if not exists public.couples (
  id uuid primary key default gen_random_uuid(),
  partner_a_name text not null default '师豪',
  partner_b_name text not null default '佳力',
  anniversary_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- 2. 情感账户：存款 / 取款明细 ----------
create table if not exists public.bank_records (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade default '00000000-0000-0000-0000-000000000000',
  date date not null,
  type text not null check (type in ('deposit','withdraw')),
  who text not null check (who in ('him','her','both')),
  event text not null,
  weight int not null default 1 check (weight in (1,2,3,5)),
  source text default 'seed' check (source in ('seed','user')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_bank_records_couple_date on public.bank_records(couple_id, date desc);

-- ---------- 3. 家庭成员档案（父母 + 兄弟姐妹 + 扩展家庭成员）----------
create table if not exists public.family_members (
  id text primary key,                                         -- 与 family.json 一致：his-dad / her-mom / m_xxx
  couple_id uuid not null references public.couples(id) on delete cascade default '00000000-0000-0000-0000-000000000000',
  side text,                                                     -- him=师豪家, her=佳力家, NULL 空=共同/其他（放宽 check 放宽为只允许枚举值或空）
  relation text,                                                 -- father/mother/brother/sister/uncle/aunt/grandpa/grandma/cousin/other（放宽 check）
  role text,
  initial text,
  name text,
  birthday text,                                               -- 放宽为 text，支持"农历X月X日等非ISO日期
  likes text,
  diet text,
  size text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 节日计划 checklist
create table if not exists public.holiday_checks (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade default '00000000-0000-0000-0000-000000000000',
  holiday_id text not null,                                       -- mid-autumn / spring-festival / parents-birthday / huimen-xieke
  item_index int not null,
  checked boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(couple_id, holiday_id, item_index)
);

-- ---------- 4. 里程碑勾选状态 ----------
create table if not exists public.milestone_items (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade default '00000000-0000-0000-0000-000000000000',
  phase_year text not null,                                       -- '2024' / '2025' / '2026' / '2027' / '2027+'
  item_date text,
  item_title text not null,
  done boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(couple_id, phase_year, item_title)
);

-- ---------- 5. 爱情地图 ----------
-- 100 道题的回答记录（可多次回答，按日期留存）
create table if not exists public.lovemap_answers (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade default '00000000-0000-0000-0000-000000000000',
  question_id text not null,                                      -- 'q1' .. 'q100'
  answerer text not null check (answerer in ('him','her','both')),
  answer_content text not null,
  answered_on date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_lovemap_answers_qid on public.lovemap_answers(couple_id, question_id);

-- 6 张卡片自定义内容（喜好 / 雷区 / 梦想 / 价值观）
create table if not exists public.lovemap_cards (
  id text primary key,                                             -- her-likes / her-landmines / his-likes / his-landmines / shared-dreams / shared-values
  couple_id uuid not null references public.couples(id) on delete cascade default '00000000-0000-0000-0000-000000000000',
  items_json jsonb not null default '[]'::jsonb,
  back_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Magic 5 hours 每周打卡
create table if not exists public.lovemap_magic5h (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade default '00000000-0000-0000-0000-000000000000',
  week_iso text not null,                                         -- '2026-W32'
  part text not null,                                             -- 'farewell' / 'reunion' / 'admire' / 'date' / 'review'
  checked boolean not null default false,
  duration_min int default 0,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(couple_id, week_iso, part)
);

-- ---------- 6. 停战协议 ----------
create table if not exists public.peace_signatures (
  side text primary key check (side in ('him','her')),
  couple_id uuid not null references public.couples(id) on delete cascade default '00000000-0000-0000-0000-000000000000',
  signed boolean not null default false,
  signed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 冲突复盘（吵架后写，之前完全没持久化）
create table if not exists public.conflict_reviews (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade default '00000000-0000-0000-0000-000000000000',
  occurred_on date not null,
  title text,
  nvc_observation text,   -- NVC 四步：观察
  nvc_feeling text,       -- 感受
  nvc_need text,          -- 需要
  nvc_request text,       -- 请求
  repair_taken text,      -- 修复尝试
  lessons text,           -- 下次怎么避免
  author text check (author in ('him','her','both')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 情感账户每周自检表打分
create table if not exists public.bank_weekly_checks (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade default '00000000-0000-0000-0000-000000000000',
  week_iso text not null,
  who text not null check (who in ('him','her')),
  score_total int not null default 0,
  deposit_checks jsonb not null default '[]'::jsonb,  -- 存款项勾选 index
  withdraw_checks jsonb not null default '[]'::jsonb, -- 扣款项勾选 index
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(couple_id, week_iso, who)
);

-- ---------- 7. 仪表盘月度目标 ----------
create table if not exists public.monthly_goals (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade default '00000000-0000-0000-0000-000000000000',
  month text not null,   -- '2026-08'
  item_index int not null,
  checked boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(couple_id, month, item_index)
);

-- ---------- 8. 婚礼决策（整块 jsonb 存，灵活）----------
create table if not exists public.wedding_decisions (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade default '00000000-0000-0000-0000-000000000000',
  pitfall_checks jsonb not null default '{}'::jsonb,    -- 避坑清单 {key: true/false}
  knob_values jsonb not null default '{}'::jsonb,        -- 三旋钮 {k1:v1, k2:v2, k3:v3}
  pre_questions jsonb not null default '{}'::jsonb,      -- 4 个先决问题 {q1:text, q2:text...}
  todos jsonb not null default '[]'::jsonb,              -- 待办 [{text, done}]
  selected_option text,
  free_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- 9. updated_at 触发器：所有表行级更新时自动刷新 updated_at ----------
do $$
declare t text;
begin
  foreach t in array array[
    'couples','bank_records','family_members','holiday_checks',
    'milestone_items','lovemap_answers','lovemap_cards','lovemap_magic5h',
    'peace_signatures','conflict_reviews','bank_weekly_checks',
    'monthly_goals','wedding_decisions'
  ] loop
    execute format('drop trigger if exists handle_updated_at on public.%I;
                    create trigger handle_updated_at before update on public.%I
                    for each row execute function moddatetime(''updated_at'');', t, t);
  end loop;
end $$;

-- ---------- 10. RLS（行级安全）----------
-- 所有表启用 RLS；由于是两人共用同一个 couple_id 的场景，policy 允许 anon 角色读写所有带 couple_id 的行
-- （如果未来要加独立登录鉴权，可以把 policy 收紧到 auth.uid() 关联的行）
do $$
declare t text;
begin
  foreach t in array array[
    'couples','bank_records','family_members','holiday_checks',
    'milestone_items','lovemap_answers','lovemap_cards','lovemap_magic5h',
    'peace_signatures','conflict_reviews','bank_weekly_checks',
    'monthly_goals','wedding_decisions'
  ] loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('drop policy if exists "anon allow all for couple" on public.%I;
                    create policy "anon allow all for couple" on public.%I
                    for all to anon using (true) with check (true);', t, t);
  end loop;
end $$;

/* =========================================================================
   11. 初始化种子数据
   =========================================================================
   插入 couples 一行 → 拿到其 uuid → 把它替换到所有业务表的默认 couple_id
   （下面的 upsert 用真实的 id；这里用一个 CTE 保证幂等：重复执行不会出错）
   ========================================================================= */

with c as (
  insert into public.couples (id, partner_a_name, partner_b_name, anniversary_date)
  values (
    'aaaa1111-bbbb-cccc-dddd-eeeeffff0001',  -- 固定 uuid，前端写死
    '师豪','佳力','2025-05-10'
  )
  on conflict (id) do update set updated_at = now()
  returning id
)
-- 把默认值替换成真实的 couple_id
update public.bank_records set couple_id = (select id from c)
where couple_id = '00000000-0000-0000-0000-000000000000';
update public.family_members set couple_id = (select id from c)
where couple_id = '00000000-0000-0000-0000-000000000000';
update public.holiday_checks set couple_id = (select id from c)
where couple_id = '00000000-0000-0000-0000-000000000000';
update public.milestone_items set couple_id = (select id from c)
where couple_id = '00000000-0000-0000-0000-000000000000';
update public.lovemap_answers set couple_id = (select id from c)
where couple_id = '00000000-0000-0000-0000-000000000000';
update public.lovemap_cards set couple_id = (select id from c)
where couple_id = '00000000-0000-0000-0000-000000000000';
update public.lovemap_magic5h set couple_id = (select id from c)
where couple_id = '00000000-0000-0000-0000-000000000000';
update public.peace_signatures set couple_id = (select id from c)
where couple_id = '00000000-0000-0000-0000-000000000000';
update public.conflict_reviews set couple_id = (select id from c)
where couple_id = '00000000-0000-0000-0000-000000000000';
update public.bank_weekly_checks set couple_id = (select id from c)
where couple_id = '00000000-0000-0000-0000-000000000000';
update public.monthly_goals set couple_id = (select id from c)
where couple_id = '00000000-0000-0000-0000-000000000000';
update public.wedding_decisions set couple_id = (select id from c)
where couple_id = '00000000-0000-0000-0000-000000000000';

-- ---------- 11-a. 情感账户 8 条种子记录 ----------
insert into public.bank_records
  (couple_id, date, type, who, event, weight, source)
values
  ('aaaa1111-bbbb-cccc-dddd-eeeeffff0001','2025-05-10','deposit','both','在缙云山第一次见面后，正式成为恋人。',5,'seed'),
  ('aaaa1111-bbbb-cccc-dddd-eeeeffff0001','2025-07-15','deposit','her','高三期末改卷最累的那周，给我留了手写小纸条。',3,'seed'),
  ('aaaa1111-bbbb-cccc-dddd-eeeeffff0001','2025-08-09','deposit','him','记住你随口提过想吃的乐山小吃，周末带去了。',3,'seed'),
  ('aaaa1111-bbbb-cccc-dddd-eeeeffff0001','2025-10-04','deposit','both','稻城亚丁，第一次一起看到雪山日出，相拥无言。',5,'seed'),
  ('aaaa1111-bbbb-cccc-dddd-eeeeffff0001','2026-02-14','deposit','him','求婚成功。把这一年走过的路，做成了一个网页送给你。',5,'seed'),
  ('aaaa1111-bbbb-cccc-dddd-eeeeffff0001','2026-05-20','deposit','her','主动提出一起列婚礼筹备清单，让我感受到你在和我一起推进。',3,'seed'),
  ('aaaa1111-bbbb-cccc-dddd-eeeeffff0001','2026-06-12','withdraw','him','你压力大时我急着给方案，被觉得“你不懂我”。（取款——但也提醒我：先共情后解决）',2,'seed'),
  ('aaaa1111-bbbb-cccc-dddd-eeeeffff0001','2026-06-20','deposit','him','为这次冲突写了道歉，并约定以后先问“你需要建议，还是陪伴？”',3,'seed')
on conflict do nothing;

-- ---------- 11-b. 家庭成员 4 条种子（只填充固定字段，待补充的留空）----------
insert into public.family_members
  (id, couple_id, side, relation, role, initial, likes, diet, notes)
values
  ('his-dad','aaaa1111-bbbb-cccc-dddd-eeeeffff0001','him','father','师豪的爸爸','爸',
    '忠县汉族、巴渝老礼。偏好可循：本地白酒（认牌子）、茶叶、香烟（重庆社交硬通货，敬长辈用）；聘礼讲究肉酒糖烟四色礼齐整。',
    '川渝家常口味，偏重油重辣；中老年留意三高（血压/血糖/血脂），宴席敬酒宜控量，少油少盐为宜。',
    '忠县父系话事，大事由父亲拍板、母亲操持。相处要点：敬重他的"面子"与"礼数周全"（提亲/聘礼/接亲/回门四步礼不能塌）。'),
  ('his-mom','aaaa1111-bbbb-cccc-dddd-eeeeffff0001','him','mother','师豪的妈妈','妈',
    '忠县汉族家庭，礼数偏中原化、重"礼数周全"。可了解是否爱广场舞、邻里串门、腌菜晒酱、追剧；送实用兼体面的小物（丝巾、茶叶、保健品）更显用心。',
    '川渝家常口味，做菜偏回锅肉/烧白一类；关注体检（乳腺/妇科/骨密度）与情绪起伏。',
    '忠县母亲操持日常但大事听父亲的，冲突倾向内化（冷战不外放）。多夸她做的菜，健康体检主动安排。'),
  ('her-dad','aaaa1111-bbbb-cccc-dddd-eeeeffff0001','her','father','佳力的爸爸','爸',
    '彭水苗族土家族自治县。先确认家族以苗族还是土家族为主：苗族家庭可留意芦笙/苗歌/银饰，土家族家庭可留意摆手舞/西兰卡普。偏好可循：苞谷酒/米酒、油茶；女婿上门带两瓶好酒最对路。',
    '彭水菜酸汤、糟辣、腊味重；饮酒习惯需了解（拦门酒/认亲酒要双手接、能饮则饮）。',
    '彭水母系遗存，岳母说话有分量、岳父可能寡言但态度关键。女婿定位"贵客+自家人"，进门先叫爸，放下东西先陪他坐十分钟聊身体/庄稼/生意。'),
  ('her-mom','aaaa1111-bbbb-cccc-dddd-eeeeffff0001','her','mother','佳力的妈妈','妈',
    '彭水苗族土家族自治县。先分清苗族 vs 土家族再选礼：苗族家庭可送苗绣小件/银饰小物，土家族家庭可送西兰卡普织锦小物。爱腌菜可带好酱/好醋；护手霜、丝巾温润。',
    '酸辣口味（酸汤鱼/腊肉/油茶/糯米粑）；留意高血压与肠胃，少食多餐为宜。',
    '彭水母系色彩重，岳母在家族事务里说话有分量、冲突外放当场好。她在厨房操持时主动问要不要帮忙切菜；菜少食多赞，绝不当面说不习惯。')
on conflict (id) do update set
  role = excluded.role,
  updated_at = now();

-- ---------- 11-c. 里程碑阶段种子（30+ 条，与 milestones.json 一致）----------
insert into public.milestone_items
  (couple_id, phase_year, item_date, item_title, done)
values
  ('aaaa1111-bbbb-cccc-dddd-eeeeffff0001','2024','2024-12-30','第一次见面',true),
  ('aaaa1111-bbbb-cccc-dddd-eeeeffff0001','2024','2024 冬','两家庭初次建立联系',true),
  ('aaaa1111-bbbb-cccc-dddd-eeeeffff0001','2025','2025-05-10','正式相恋',true),
  ('aaaa1111-bbbb-cccc-dddd-eeeeffff0001','2025','2025 夏秋','目的地考察',true),
  ('aaaa1111-bbbb-cccc-dddd-eeeeffff0001','2025','2025-10','稻城亚丁',true),
  ('aaaa1111-bbbb-cccc-dddd-eeeeffff0001','2026','2026-02-14','求婚成功',true),
  ('aaaa1111-bbbb-cccc-dddd-eeeeffff0001','2026','2026 下半年','提亲订婚',false),
  ('aaaa1111-bbbb-cccc-dddd-eeeeffff0001','2026','2026 下半年','婚纱照拍摄',false),
  ('aaaa1111-bbbb-cccc-dddd-eeeeffff0001','2026','2026-12 前','选定四大金刚',false),
  ('aaaa1111-bbbb-cccc-dddd-eeeeffff0001','2027','2027-07~08','婚礼',false),
  ('aaaa1111-bbbb-cccc-dddd-eeeeffff0001','2027','2027 婚后','蜜月',false),
  ('aaaa1111-bbbb-cccc-dddd-eeeeffff0001','2027+','2027-2028','婚后第一年适应期',false),
  ('aaaa1111-bbbb-cccc-dddd-eeeeffff0001','2027+','2028','买房 / 安居计划',false),
  ('aaaa1111-bbbb-cccc-dddd-eeeeffff0001','2027+','待定','职业转型与家庭平衡',false)
on conflict (couple_id, phase_year, item_title) do update set updated_at = now();

-- ---------- 11-d. 爱情地图 6 张卡片种子（与 love-map.json 一致）----------
insert into public.lovemap_cards (id, couple_id, items_json, back_note)
values
  ('her-likes','aaaa1111-bbbb-cccc-dddd-eeeeffff0001',
    '["被看见、被认真倾听（不要急着给方案）","仪式感与小惊喜","旅行时拍下属于我们的画面","被牵着手散步","认真被对待的感觉"]',
    '提示：定期更新这张地图，人会变。'),
  ('her-landmines','aaaa1111-bbbb-cccc-dddd-eeeeffff0001',
    '["高三压力大时被否定情绪（"这有什么"）","被冷处理/沉默","被当众纠正或贬低","承诺了又落空","被拿去和别人比较"]',
    '了解雷区，是为了不去踩，而非拿去攻击。'),
  ('his-likes','aaaa1111-bbbb-cccc-dddd-eeeeffff0001',
    '["被肯定推进与主动性","理性被看见而不被当作冷漠","一起做规划与复盘","安静的陪伴","被需要的感觉"]',
    '我也需要被了解，不要总当"坚强的一方"。'),
  ('his-landmines','aaaa1111-bbbb-cccc-dddd-eeeeffff0001',
    '["付出不被看见时的失落","被一句"你都不…"全盘否定","冲突中被翻旧账","被催促立刻做决定","我的家人被冒犯"]',
    '说出来，不是软弱，是邀请你懂我。'),
  ('shared-dreams','aaaa1111-bbbb-cccc-dddd-eeeeffff0001',
    '["一次只属于两个人的目的地婚礼","婚后每年一次"无手机"旅行","买房安一个属于我们的小窝","一起把两个家庭温柔地连起来","老了还能手牵手散步"]',
    '梦想会长大，每年纪念日来更新一次。'),
  ('shared-values','aaaa1111-bbbb-cccc-dddd-eeeeffff0001',
    '["真诚胜过体面","主动胜过被催","长期主义胜过短期满足","小确幸也是大事","家是用来休息的，不是战场"]',
    '价值观是底座，冲突时回到这里。')
on conflict (id) do update set updated_at = now();

-- ---------- 11-e. 停战协议签字状态（默认未签）----------
insert into public.peace_signatures (side, couple_id, signed)
values ('him','aaaa1111-bbbb-cccc-dddd-eeeeffff0001',false),
       ('her','aaaa1111-bbbb-cccc-dddd-eeeeffff0001',false)
on conflict (side) do nothing;

-- ---------- 11-f. 婚礼决策一行（默认空）----------
insert into public.wedding_decisions (couple_id)
values ('aaaa1111-bbbb-cccc-dddd-eeeeffff0001')
on conflict do nothing;

/* =========================================================================
   🔧 补丁（PATCH）：如果之前已建过表，请单独执行下面这段
   作用：放宽 family_members 表的 side/relation 枚举约束 + birthday 类型 + 种子称呼升级
   ========================================================================= */
do $$
begin
  -- 1. 删除旧 check 约束（如果存在，名字自动生成的，遍历所有以 family_members_side_check / relation_check 结尾的）
  execute (
    select coalesce(string_agg('alter table public.family_members drop constraint if exists ' || quote_ident(conname) || ';', E'\n'), '')
    from pg_constraint
    where conrelid = 'public.family_members'::regclass
      and (conname like '%side%check%' or conname like '%relation%check%' or conname like '%birthday%')
  );

  -- 2. 更改 birthday 列类型为 text（date 列需要 using 转换）
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='family_members'
      and column_name='birthday' and data_type='date'
  ) then
    alter table public.family_members alter column birthday type text using birthday::text;
  end if;

  -- 3. 把 4 条默认父母的旧"我的父亲/母亲、你的父亲/母亲"旧称呼升级为新
  update public.family_members
  set role = case id
    when 'his-dad' then '师豪的爸爸'
    when 'his-mom' then '师豪的妈妈'
    when 'her-dad' then '佳力的爸爸'
    when 'her-mom' then '佳力的妈妈'
    else role
  end
  where id in ('his-dad','his-mom','her-dad','her-mom')
    and role in ('我的父亲','我的母亲','你的父亲','你的母亲');
end $$;

/* =========================================================================
   完成 ✅
   验证：
   select count(*) from public.bank_records;     → 应该是 8
   select count(*) from public.family_members;    → 应该是 4
   select count(*) from public.milestone_items;   → 应该是 14
   select count(*) from public.lovemap_cards;     → 应该是 6
   select count(*) from public.peace_signatures;  → 应该是 2
   ========================================================================= */
