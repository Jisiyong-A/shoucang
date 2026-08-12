#!/usr/bin/env python3
"""Generate the Task 06 §9 demo test set (6 self-made Chinese OCR test images).

Images:
  01 中文长图     - long-form Chinese text (screenshot-like)
  02 中英混排     - mixed Chinese/English (design terms: SANAA, BIM...)
  03 低对比       - low contrast gray-on-gray
  04 深色背景     - dark background, light text
  05 小字号       - small font size
  06 建筑标注     - architectural drawing annotations
"""
import os
from PIL import Image, ImageDraw, ImageFont

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "ocr_testset")
os.makedirs(OUT, exist_ok=True)

# Windows built-in fonts (msyh = 微软雅黑; simhei = 黑体)
FONT_BIG = r"C:\Windows\Fonts\msyh.ttc"
FONT_SMALL = r"C:\Windows\Fonts\msyh.ttc"
FONT_HEI = r"C:\Windows\Fonts\simhei.ttf"


def font(path, size):
    try:
        return ImageFont.truetype(path, size)
    except Exception:
        return ImageFont.load_default()


def render(name, width, height, bg, fg, lines, fsize=34, fpath=FONT_BIG, spacing=12, x=40, y=40):
    img = Image.new("RGB", (width, height), bg)
    d = ImageDraw.Draw(img)
    f = font(fpath, fsize)
    ty = y
    for line in lines:
        d.text((x, ty), line, fill=fg, font=f)
        ty += fsize + spacing
    img.save(os.path.join(OUT, name))
    print(f"wrote {name} ({width}x{height})")


# 01 中文长图（模拟截图长文）
lines1 = [
    "金泽二十一世纪美术馆建成于 2004 年，由 SANAA 事务所设计。",
    "建筑的圆形平面直径达到 112.5 米，外立面采用大面积弧形玻璃幕墙。",
    "这座美术馆最大的特点是取消了传统意义上的正面与背面，",
    "访客可以从四面八方进入建筑，公园与室内空间连成一片。",
    "内部展厅采用白色极简风格，混凝土与玻璃的交接处理得非常干净。",
    "设计团队希望通过透明边界模糊室内外的区别，让美术馆成为城市客厅。",
    "美术馆开幕以来接待了超过两千万名访客，成为金泽的城市名片。",
    "二〇〇四年该项目获得威尼斯建筑双年展金狮奖的提名。",
]
render("01_chinese_long.png", 900, 480, (255, 255, 255), (20, 20, 20), lines1)

# 02 中英混排
lines2 = [
    "KANKAN LOCAL ARCHIVE 本地收藏",
    "建筑师：BIG | 项目：VIA 57 WEST",
    "The facade uses 45-degree zigzag geometry.",
    "立面采用四十五度折线几何，形成金字塔般的轮廓。",
    "BIM 模型与现场施工图完全一致，误差控制在五毫米内。",
    "Terminal A 出发层，Gate C18，下一班航班 14:30。",
]
render("02_mixed.png", 900, 400, (255, 255, 255), (10, 10, 10), lines2)

# 03 低对比（灰底灰字）
render("03_low_contrast.png", 800, 300, (200, 200, 200), (160, 160, 160),
       ["低对比度文本测试", "这种颜色接近时很难辨认", "浅灰与中灰的边界"], fsize=38)

# 04 深色背景
render("04_dark_bg.png", 800, 300, (18, 18, 22), (230, 230, 235),
       ["深色背景上的文字", "OLED 纯黑界面中的笔记", "夜览模式下阅读"], fsize=38)

# 05 小字号
lines5 = [
    "收藏夹：建筑参考 ｜ 分类：住宅 ｜ 作者：ArchDaily",
    "北海道白色木造住宅，屋顶坡度三十度，檐口出挑六百毫米。",
    "室内层高三米二，南向开窗，冬季日照角度约二十三度。",
]
render("05_small_font.png", 900, 260, (255, 255, 255), (30, 30, 30), lines5, fsize=16, spacing=4)

# 06 建筑标注（示意图风格）
render("06_arch_annotation.png", 900, 420, (250, 250, 245), (40, 40, 40), [
    "一层平面 1:100",
    "客厅 LIVING ROOM 4.8m x 6.2m",
    "厨房 KITCHEN 3.0m x 3.6m",
    "卫生间 WC 1.8m x 2.4m",
    "挑空 DOUBLE HEIGHT",
    "檐口标高 +6.300",
], fpath=FONT_HEI, fsize=28)

print("all done")
