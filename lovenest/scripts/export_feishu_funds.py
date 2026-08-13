#!/usr/bin/env python3
"""从飞书 annotated_csv 文本解析出最新数据 tab，导出为 data/feishu_funds.json
用法: python3 scripts/export_feishu_funds.py <annotated_csv_text_file>
或直接用 stdin: lark-cli sheets +csv-get ... | python3 scripts/export_feishu_funds.py --stdin
"""
import json, re, sys
from pathlib import Path

HEADER = [
    "code","name","fund_size","establish_date","nav","nav_date",
    "one_year_return","daily_change","management_fee","risk_level",
    "max_value","min_value","max_date","min_date",
    "target_audience","historical_win_rate","peer_compare","temp","temp_comment",
    "daily_nav","since_inception_return","investment_sectors","position_valuation",
    "halfyear_profit_prob","indicator_1y_return","future_trend","change_date",
    "sector_allocation","asset_allocation","risk_rating"
]

def parse_annotated(text: str):
    rows = []
    for line in text.splitlines():
        line = line.strip()
        m = re.match(r"\[row=\d+\]\s*(.*)", line)
        if not m:
            continue
        rest = m.group(1)
        # 用逗号分隔，但保持简单 split（飞书单元格里无逗号）
        cells = rest.split(",")
        # 表头 row=1 跳过
        if len(rows) == 0 and cells and cells[0] == "基金代码":
            continue
        obj = {}
        for i, key in enumerate(HEADER):
            obj[key] = cells[i].strip() if i < len(cells) else ""
        # 只保留有代码的记录
        if obj.get("code"):
            rows.append(obj)
    return rows

def main():
    if "--stdin" in sys.argv or not sys.stdin.isatty():
        text = sys.stdin.read()
    elif len(sys.argv) >= 2:
        text = Path(sys.argv[1]).read_text(encoding="utf-8")
    else:
        print("Usage: python3 export_feishu_funds.py [file] or --stdin", file=sys.stderr)
        sys.exit(1)
    rows = parse_annotated(text)
    out = {
        "source": "feishu_sheet_4e7337",
        "exported_at": __import__("datetime").datetime.now().astimezone().isoformat(),
        "count": len(rows),
        "items": rows
    }
    dest = Path(__file__).resolve().parent.parent / "data" / "feishu_funds.json"
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"OK -> {dest} ({len(rows)} funds)")

if __name__ == "__main__":
    main()
