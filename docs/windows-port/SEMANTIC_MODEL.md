# 语义模型获取（public/models/ 不入 git）

嵌入模型（561MB）不进入 git 仓库。构建安装包前需手动放置：

```bash
# multilingual-e5-large (int8 ONNX, Apache-2.0 模型权重许可见 HF 页面)
mkdir -p public/models/multilingual-e5-large/onnx
cd public/models/multilingual-e5-large
for f in config.json tokenizer.json tokenizer_config.json quant_config.json \
         special_tokens_map.json onnx/model_quantized.onnx; do
  curl -L -x http://127.0.0.1:7890 -o "$f" \
    "https://huggingface.co/Xenova/multilingual-e5-large/resolve/main/$f"
done
```

构建时 `npm run build` 的 postbuild（scripts/sync-models.cjs）自动同步到 dist/，
安装包（NSIS）包含模型后即可完全离线运行语义搜索。
