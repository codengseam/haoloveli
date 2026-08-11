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

-- ---------- 8. 美食偏好：家庭成员各自喜欢的食物 ----------
create table if not exists public.food_preferences (
  id text primary key,                                         -- 主键：f_xxx
  couple_id uuid not null references public.couples(id) on delete cascade default '00000000-0000-0000-0000-000000000000',
  owner text not null,                                          -- him=师豪, her=佳力, 或其他成员 id/name
  name text not null,                                           -- 食物名称：番茄炒蛋 / 榴莲
  category text not null default 'meal' check (category in ('meal','snack','fruit','veg','drink','other')),  -- 正餐/零食/水果/蔬菜/饮品/其他
  rating int not null default 5 check (rating between 1 and 10),  -- 打分 1-10
  reason text,                                                  -- 喜欢理由：如"高蛋白、鲜、下饭"
  review text,                                                  -- 详细评价/口感描述
  tags jsonb not null default '[]'::jsonb,                      -- 口味标签：["辣","鲜","高蛋白"]
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_food_prefs_owner on public.food_preferences(couple_id, owner);
create index if not exists idx_food_prefs_category on public.food_preferences(couple_id, category);

-- ---------- 9. 婚礼决策（整块 jsonb 存，灵活）----------
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
    'monthly_goals','wedding_decisions','food_preferences'
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
    'monthly_goals','wedding_decisions','food_preferences'
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
   couple_id 用固定值 aaaa1111-bbbb-cccc-dddd-eeeeffff0001（与 shared/config.js 一致）
   注意：PostgreSQL 的 WITH ... UPDATE 语句里，CTE 的名字只对紧接其后的 1 条 UPDATE 有效，
   所以这里不用 CTE，直接用字面量。后续如果想改成动态取 id，可把每条 UPDATE 写成独立的
   `with c as (select id from public.couples limit 1) update ... from c;`。
   ========================================================================= */

-- 先确保 couples 里有这一行（固定种子，不随 id 变化，前端写死）
insert into public.couples (id, partner_a_name, partner_b_name, anniversary_date)
values (
  'aaaa1111-bbbb-cccc-dddd-eeeeffff0001',
  '师豪','佳力','2025-05-10'
)
on conflict (id) do update set
  partner_a_name = excluded.partner_a_name,
  partner_b_name = excluded.partner_b_name,
  anniversary_date = excluded.anniversary_date,
  updated_at = now();

-- 把默认占位的 couple_id 替换成真实值（所有业务表）
do $$
declare
  real_id uuid := 'aaaa1111-bbbb-cccc-dddd-eeeeffff0001'::uuid;
  zero_id uuid := '00000000-0000-0000-0000-000000000000'::uuid;
  t text;
begin
  foreach t in array array[
    'bank_records','family_members','holiday_checks','milestone_items',
    'lovemap_answers','lovemap_cards','lovemap_magic5h','peace_signatures',
    'conflict_reviews','bank_weekly_checks','monthly_goals','wedding_decisions','food_preferences'
  ] loop
    execute format(
      'update public.%I set couple_id = %L where couple_id = %L;',
      t, real_id, zero_id
    );
  end loop;
end $$;

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

-- ---------- 11-g. 美食偏好种子（师豪 8 条 + 佳力 13 条）----------
insert into public.food_preferences
  (id, couple_id, owner, name, category, rating, reason, review, tags)
values
  -- 师豪的美食
  ('f_shihao_1','aaaa1111-bbbb-cccc-dddd-eeeeffff0001','him','番茄炒蛋','meal',9,'鲜、高蛋白、下饭神器','番茄酸甜开胃，鸡蛋嫩滑，拌饭一绝，家常味天花板','["鲜","高蛋白","下饭","家常"]'),
  ('f_shihao_2','aaaa1111-bbbb-cccc-dddd-eeeeffff0001','him','蒸蛋','meal',8,'嫩、鲜、高蛋白、清淡养胃','入口即化，口感嫩滑，配生抽香油，简单又好吃','["鲜","高蛋白","清淡","嫩"]'),
  ('f_shihao_3','aaaa1111-bbbb-cccc-dddd-eeeeffff0001','him','海带','veg',7,'鲜、健康、低卡','凉拌爽脆，炖汤入味，吃着有海洋的鲜味','["鲜","健康","低卡","爽脆"]'),
  ('f_shihao_4','aaaa1111-bbbb-cccc-dddd-eeeeffff0001','him','红烧牛肉','meal',10,'香、有味道、高蛋白、肉食满足','红烧入味、肥瘦相间、酱汁浓郁，配米饭绝了，肉食主义的最爱','["高蛋白","肉食","入味","香"]'),
  ('f_shihao_5','aaaa1111-bbbb-cccc-dddd-eeeeffff0001','him','烧烤','snack',9,'辣、香、有味道、夜宵灵魂','烤串焦香四溢，撒上辣椒孜然，啤酒伴侣，夜宵首选','["辣","香","夜宵","重口味"]'),
  ('f_shihao_6','aaaa1111-bbbb-cccc-dddd-eeeeffff0001','him','火锅','meal',10,'辣、鲜、肉食盛宴、热闹','牛油锅底够味，毛肚鸭肠牛肉涮起来，围坐一起的幸福感拉满','["辣","鲜","肉食","社交"]'),
  ('f_shihao_7','aaaa1111-bbbb-cccc-dddd-eeeeffff0001','him','串串','meal',9,'辣、有味道、选择多、接地气','签签牛肉、掌中宝、郡肝，一串一口，吃的就是巴适','["辣","重口味","接地气","肉食"]'),
  ('f_shihao_8','aaaa1111-bbbb-cccc-dddd-eeeeffff0001','him','豆腐','veg',8,'鲜、高蛋白、百变、嫩滑','麻婆豆腐够味、豆花嫩滑、豆腐汤鲜，怎么做都好吃','["鲜","高蛋白","嫩滑","百变"]'),
  -- 佳力的美食
  ('f_jiali_1','aaaa1111-bbbb-cccc-dddd-eeeeffff0001','her','面','meal',9,'主食、辣、碳水快乐','重庆小面、牛肉面、肥肠面，早上一碗面，一天都满足','["主食","辣","碳水","重庆味"]'),
  ('f_jiali_2','aaaa1111-bbbb-cccc-dddd-eeeeffff0001','her','米粉','meal',8,'主食、顺滑、家乡味','彭水米粉粗细合适，臊子香，嗦一口就是回家的感觉','["主食","顺滑","家乡味","碳水"]'),
  ('f_jiali_3','aaaa1111-bbbb-cccc-dddd-eeeeffff0001','her','苕皮','snack',9,'辣、Q弹、烤着香','烤苕皮裹酸萝卜香菜，外焦里糯，咬一口满足感爆棚','["辣","Q弹","烧烤","糯"]'),
  ('f_jiali_4','aaaa1111-bbbb-cccc-dddd-eeeeffff0001','her','红苕粉','meal',8,'主食、辣、顺滑、彭水味','彭水酸辣粉，红薯粉劲道，酸辣开胃，家乡味道','["主食","辣","顺滑","家乡味"]'),
  ('f_jiali_5','aaaa1111-bbbb-cccc-dddd-eeeeffff0001','her','干锅鸡杂','meal',9,'辣、素菜多、下饭、重口味','鸡杂脆嫩，藕片土豆魔芋入味，干锅干香，下饭神器','["辣","下饭","素菜","脆嫩"]'),
  ('f_jiali_6','aaaa1111-bbbb-cccc-dddd-eeeeffff0001','her','榴莲','fruit',10,'甜、香、水果之王、独特','榴莲肉绵密香甜，入口即化，越吃越上头，独特的香气让人欲罢不能','["甜","绵密","香甜","独特"]'),
  ('f_jiali_7','aaaa1111-bbbb-cccc-dddd-eeeeffff0001','her','儿菜','veg',7,'素菜、清爽、家常','儿菜清炒或煮汤，清爽解腻，家常菜的温暖','["素菜","清爽","家常","解腻"]'),
  ('f_jiali_8','aaaa1111-bbbb-cccc-dddd-eeeeffff0001','her','渣海椒','other',8,'辣、下饭、彭水特色、发酵香','渣海椒回锅肉或炒鸡蛋，发酵的酸辣味，彭水人的下饭灵魂','["辣","下饭","发酵","彭水特色"]'),
  ('f_jiali_9','aaaa1111-bbbb-cccc-dddd-eeeeffff0001','her','火锅','meal',10,'辣、素菜多、一起吃更开心','火锅煮贡菜苕皮土豆毛肚，辣得过瘾，和喜欢的人一起吃更幸福','["辣","素菜","社交","重口味"]'),
  ('f_jiali_10','aaaa1111-bbbb-cccc-dddd-eeeeffff0001','her','串串','meal',9,'辣、选择多、素菜也香','签签贡菜、土豆、藕片、木耳，蘸干油碟，巴适得板','["辣","素菜","接地气","选择多"]'),
  ('f_jiali_11','aaaa1111-bbbb-cccc-dddd-eeeeffff0001','her','淀粉肠','snack',8,'香、脆、路边摊回忆','炸得金黄焦脆的淀粉肠，刷上辣椒面，童年回忆拉满','["香","脆","油炸","童年味"]'),
  ('f_jiali_12','aaaa1111-bbbb-cccc-dddd-eeeeffff0001','her','贡菜','veg',8,'脆、素菜、火锅必备','火锅烫几秒就好，嘎嘣脆的口感，一口一个停不下来','["脆","素菜","火锅","清爽"]'),
  ('f_jiali_13','aaaa1111-bbbb-cccc-dddd-eeeeffff0001','her','土豆','veg',9,'素菜、百变、碳水快乐','土豆丝、土豆片、狼牙土豆、炸薯条，怎么做都爱吃','["素菜","碳水","百变","香脆"]')
on conflict (id) do update set
  name = excluded.name,
  updated_at = now();

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
   🔧 补丁 2（PATCH 2）：账号系统 + 站点配置表
   如果之前已执行过初版 SQL，请单独执行下面这段；
   若首次全量初始化，直接跟着前面的代码一起执行也不会有冲突。
   新增：
     - site_accounts 表（多用户/角色账号管理）
     - site_config   表（系统级 key-value 配置）
     - 对应的 updated_at 触发器 + RLS 匿名全权限策略
     - 3 条种子账号 + 从 couples 表同步已有字段到 site_config
   ========================================================================= */

-- ---------- P2-1. site_accounts 表：站点账号 ----------
create table if not exists public.site_accounts (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade default 'aaaa1111-bbbb-cccc-dddd-eeeeffff0001',
  username text not null,
  password text not null,
  display_name text,
  role text not null default 'user' check (role in ('admin','user')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists idx_site_accounts_username on public.site_accounts(username);
create index if not exists idx_site_accounts_couple on public.site_accounts(couple_id);

-- ---------- P2-2. site_config 表：系统级 key-value 配置 ----------
create table if not exists public.site_config (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade default 'aaaa1111-bbbb-cccc-dddd-eeeeffff0001',
  cfg_key text not null,
  cfg_value text,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists idx_site_config_couple_key on public.site_config(couple_id, cfg_key);

-- ---------- P2-3. updated_at 触发器 ----------
do $$
declare t text;
begin
  foreach t in array array['site_accounts','site_config'] loop
    execute format('drop trigger if exists handle_updated_at on public.%I;
                    create trigger handle_updated_at before update on public.%I
                    for each row execute function moddatetime(''updated_at'');', t, t);
  end loop;
end $$;

-- ---------- P2-4. RLS（行级安全）----------
do $$
declare t text;
begin
  foreach t in array array['site_accounts','site_config'] loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('drop policy if exists "anon allow all for couple" on public.%I;
                    create policy "anon allow all for couple" on public.%I
                    for all to anon using (true) with check (true);', t, t);
  end loop;
end $$;

-- ---------- P2-5. 种子账号数据 ----------
-- admin/admin（后台管理员）、djl/19990108（佳力）、dxsh/19980720（师豪）
insert into public.site_accounts (couple_id, username, password, display_name, role, is_active) values
  ('aaaa1111-bbbb-cccc-dddd-eeeeffff0001','admin','admin','后台管理员','admin',true),
  ('aaaa1111-bbbb-cccc-dddd-eeeeffff0001','djl','19990108','佳力','user',true),
  ('aaaa1111-bbbb-cccc-dddd-eeeeffff0001','dxsh','19980720','师豪','user',true)
on conflict (username) do update set
  password    = excluded.password,
  display_name= excluded.display_name,
  role        = excluded.role,
  is_active   = excluded.is_active,
  updated_at  = now();

-- ---------- P2-6. 从 couples 表同步已有字段到 site_config ----------
-- 伴侣姓名 A / 伴侣姓名 B / 纪念日日期 / 站点标题 四个字段同步为 key-value
insert into public.site_config (couple_id, cfg_key, cfg_value, updated_by)
select c.id, 'partner_a_name', c.partner_a_name, 'system-migrate'
from public.couples c where c.id = 'aaaa1111-bbbb-cccc-dddd-eeeeffff0001'
on conflict (couple_id, cfg_key) do nothing;

insert into public.site_config (couple_id, cfg_key, cfg_value, updated_by)
select c.id, 'partner_b_name', c.partner_b_name, 'system-migrate'
from public.couples c where c.id = 'aaaa1111-bbbb-cccc-dddd-eeeeffff0001'
on conflict (couple_id, cfg_key) do nothing;

insert into public.site_config (couple_id, cfg_key, cfg_value, updated_by)
select c.id, 'anniversary_date', c.anniversary_date::text, 'system-migrate'
from public.couples c where c.id = 'aaaa1111-bbbb-cccc-dddd-eeeeffff0001' and c.anniversary_date is not null
on conflict (couple_id, cfg_key) do nothing;

insert into public.site_config (couple_id, cfg_key, cfg_value, updated_by)
values ('aaaa1111-bbbb-cccc-dddd-eeeeffff0001','site_title','豪❤力 · 爱的小窝','system-seed')
on conflict (couple_id, cfg_key) do nothing;

/* =========================================================================
   完成 ✅
   验证：
   select count(*) from public.bank_records;     → 应该是 8
   select count(*) from public.family_members;    → 应该是 4
   select count(*) from public.milestone_items;   → 应该是 14
   select count(*) from public.lovemap_cards;     → 应该是 6
   select count(*) from public.peace_signatures;  → 应该是 2
   select count(*) from public.site_accounts;     → 应该是 3（补丁2新增）
   select count(*) from public.site_config;       → 应该是 4（补丁2新增）
   ========================================================================= */
