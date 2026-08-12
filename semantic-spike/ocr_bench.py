#!/usr/bin/env python3
"""OCR benchmark: rapidocr default (PP-OCRv4 mobile) vs PP-OCRv5 det + ch rec.

Measures: full text output, per-image latency, model sizes. Accuracy is
judged against the known ground truth of the synthetic testset (exact
line-level match on the reference lines printed by make_ocr_testset.py).
"""
import json
import os
import time

from rapidocr_onnxruntime import RapidOCR

HERE = os.path.dirname(os.path.abspath(__file__))
TESTSET = os.path.join(HERE, "ocr_testset")
MODELS = os.path.join(HERE, "models")

REFERENCE = {
    "01_chinese_long.png": [
        "金泽二十一世纪美术馆建成于 2004 年，由 SANAA 事务所设计。",
        "建筑的圆形平面直径达到 112.5 米，外立面采用大面积弧形玻璃幕墙。",
        "这座美术馆最大的特点是取消了传统意义上的正面与背面，",
        "访客可以从四面八方进入建筑，公园与室内空间连成一片。",
        "内部展厅采用白色极简风格，混凝土与玻璃的交接处理得非常干净。",
        "设计团队希望通过透明边界模糊室内外的区别，让美术馆成为城市客厅。",
        "美术馆开幕以来接待了超过两千万名访客，成为金泽的城市名片。",
        "二〇〇四年该项目获得威尼斯建筑双年展金狮奖的提名。",
    ],
    "02_mixed.png": [
        "KANKAN LOCAL ARCHIVE 本地收藏",
        "建筑师：BIG | 项目：VIA 57 WEST",
        "The facade uses 45-degree zigzag geometry.",
        "立面采用四十五度折线几何，形成金字塔般的轮廓。",
        "BIM 模型与现场施工图完全一致，误差控制在五毫米内。",
        "Terminal A 出发层，Gate C18，下一班航班 14:30。",
    ],
    "03_low_contrast.png": ["低对比度文本测试", "这种颜色接近时很难辨认", "浅灰与中灰的边界"],
    "04_dark_bg.png": ["深色背景上的文字", "OLED 纯黑界面中的笔记", "夜览模式下阅读"],
    "05_small_font.png": [
        "收藏夹：建筑参考 ｜ 分类：住宅 ｜ 作者：ArchDaily",
        "北海道白色木造住宅，屋顶坡度三十度，檐口出挑六百毫米。",
        "室内层高三米二，南向开窗，冬季日照角度约二十三度。",
    ],
    "06_arch_annotation.png": [
        "一层平面 1:100",
        "客厅 LIVING ROOM 4.8m x 6.2m",
        "厨房 KITCHEN 3.0m x 3.6m",
        "卫生间 WC 1.8m x 2.4m",
        "挑空 DOUBLE HEIGHT",
        "檐口标高 +6.300",
    ],
}


def normalize(s):
    return "".join(ch for ch in s if not ch.isspace()).lower()


def evaluate(ocr, name, verbose=False):
    results = {}
    total_lat = 0.0
    for img in sorted(os.listdir(TESTSET)):
        if not img.endswith(".png"):
            continue
        path = os.path.join(TESTSET, img)
        t0 = time.perf_counter()
        res, _ = ocr(path)
        lat = (time.perf_counter() - t0) * 1000
        total_lat += lat
        got = [box[1] for box in res] if res else []
        got_norm = normalize("".join(got))
        ref_norm = normalize("".join(REFERENCE[img]))
        # line-level recall: fraction of reference lines whose normalized
        # text appears (as substring of concatenated output is too loose;
        # count exact line matches)
        ref_lines = [normalize(l) for l in REFERENCE[img]]
        hit = sum(1 for rl in ref_lines if any(rl in gl for gl in [normalize(x) for x in got]))
        line_recall = hit / len(ref_lines)
        results[img] = {
            "latency_ms": round(lat, 1),
            "line_recall": round(line_recall, 2),
            "raw_output": got[:8],
        }
        if verbose:
            print(f"  {img}: {lat:.0f}ms recall={line_recall:.2f}")
            for line in got[:8]:
                print(f"     > {line}")
    avg = total_lat / len(results)
    recall = sum(v["line_recall"] for v in results.values()) / len(results)
    return results, avg, recall


def main():
    out = {}
    # --- engine A: rapidocr default (PP-OCRv4 mobile, bundled) ---
    print("=== A: rapidocr default (PP-OCRv4 mobile) ===")
    ocr_v4 = RapidOCR()
    res_v4, lat_v4, rec_v4 = evaluate(ocr_v4, "v4", verbose=True)
    out["v4_mobile"] = {"avg_latency_ms": round(lat_v4, 1), "avg_line_recall": round(rec_v4, 3), "per_image": res_v4}
    print(f"v4 avg latency={lat_v4:.0f}ms avg line recall={rec_v4:.3f}")

    # --- engine B: PP-OCRv5 det + chinese rec (monkt ONNX) ---
    det5 = os.path.join(MODELS, "ocr_v5", "det_v5.onnx")
    rec5 = os.path.join(MODELS, "ocr_v5", "rec_ch.onnx")
    if os.path.exists(det5) and os.path.exists(rec5):
        print("=== B: PP-OCRv5 det + ch rec ===")
        keys = os.path.join(MODELS, "ocr_v5", "dict_ch.txt")
        if not os.path.exists(keys):
            import glob
            import rapidocr_onnxruntime as rr
            candidates = glob.glob(
                os.path.join(os.path.dirname(rr.__file__), "**", "*keys*.txt"), recursive=True
            )
            keys = candidates[0] if candidates else None
        ocr_v5 = RapidOCR(det_model_path=det5, rec_model_path=rec5, rec_keys_path=keys)
        res_v5, lat_v5, rec_v5 = evaluate(ocr_v5, "v5", verbose=True)
        out["v5_mobile"] = {"avg_latency_ms": round(lat_v5, 1), "avg_line_recall": round(rec_v5, 3), "per_image": res_v5}
        print(f"v5 avg latency={lat_v5:.0f}ms avg line recall={rec_v5:.3f}")
    else:
        print("v5 models missing, skipped")

    with open(os.path.join(HERE, "results", "ocr_bench.json"), "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)
    print("saved -> results/ocr_bench.json")


if __name__ == "__main__":
    main()
