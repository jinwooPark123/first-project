from flask import Flask, Response, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
import os

load_dotenv()
from ai_handler import (
    stream_predict_text,
    generate_suggestions,
    generate_questions,
    generate_corrections,
)

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})

api_key = os.getenv("OPENAI_API_KEY")
if not api_key:
    print("[경고] OPENAI_API_KEY가 .env에서 감지되지 않았습니다.")

# =========================================
# 1️⃣ 실시간 AI Cursor (SSE)
# =========================================
@app.route("/stream", methods=["POST"])
def stream():
    user_input = request.json.get("message", "")
    tone = request.json.get("tone", "자동 감지")

    def generate():
        for token in stream_predict_text(user_input, tone):
            yield f"data: {token}\n\n"
        yield "data: [DONE]\n\n"

    return Response(generate(), mimetype="text/event-stream")


# =========================================
# 2️⃣ 다중 제안 / 사고유도 / 문체교정
# =========================================
@app.route("/suggest", methods=["POST"])
def suggest():
    data = request.json or {}
    user_input = data.get("message", "")
    tone = data.get("tone", "자동 감지")

    try:
        suggestions = generate_suggestions(user_input, tone)
        questions = generate_questions(user_input, tone)
        corrections = generate_corrections(user_input, tone)
        return jsonify({
            "suggestions": suggestions,
            "questions": questions,
            "corrections": corrections
        })
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=True, threaded=True)
