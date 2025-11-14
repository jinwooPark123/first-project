from flask import Flask, Response, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
import os
import sys
from ai_handler import (
    stream_predict_text,
    stream_generate_suggestions,
    generate_suggestions,
    detect_errors,
    generate_suggestions_streamed,  # ✅ 새 함수 추가
)

# ------------------------------------------------------------
# 환경 변수 로드
# ------------------------------------------------------------
load_dotenv()

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})

api_key = os.getenv("OPENAI_API_KEY")
if not api_key:
    print("[경고] OPENAI_API_KEY가 .env에서 감지되지 않았습니다.")


# ------------------------------------------------------------
# 1️⃣ 최신 입력 데이터 임시 저장
# ------------------------------------------------------------
latest_input = {"message": "", "tone": "자동 감지"}


@app.route("/stream", methods=["POST"])
def stream_post():
    """React에서 입력 데이터를 받아 저장"""
    data = request.json or {}
    latest_input["message"] = data.get("message", "")
    latest_input["tone"] = data.get("tone", "자동 감지")
    return jsonify({"status": "ready"})


# ------------------------------------------------------------
# 2️⃣ 실시간 예측 (AI Cursor)
# ------------------------------------------------------------
@app.route("/stream-events", methods=["GET"])
def stream_events():
    """문장 입력 중 실시간 예측 스트리밍"""
    def generate():
        for token in stream_predict_text(latest_input["message"], latest_input["tone"]):
            yield f"data: {token}\n\n"
            sys.stdout.flush()
        yield "data: [DONE]\n\n"
        sys.stdout.flush()

    return Response(generate(), mimetype="text/event-stream", headers={
        "Cache-Control": "no-cache",
        "X-Accel-Buffering": "no",
        "Transfer-Encoding": "chunked",
        "Connection": "keep-alive",
        "Access-Control-Allow-Origin": "*",
    })


# ------------------------------------------------------------
# 3️⃣ 문장 제안 (일괄 응답)
# ------------------------------------------------------------
@app.route("/suggest", methods=["POST"])
def suggest():
    """문장 제안 (일괄 응답)"""
    data = request.json or {}
    user_input = data.get("message", "")
    tone = data.get("tone", "자동 감지")

    suggestions = generate_suggestions(user_input, tone)
    return jsonify({
        "suggestions": suggestions
    })


# ------------------------------------------------------------
# 4️⃣ 실시간 문장 제안 (SSE) - 문장 번호 부여
# ------------------------------------------------------------
@app.route("/suggest-stream", methods=["GET"])
def suggest_stream():
    """문장 제안 (SSE) - 문장 번호 및 가독성 강화"""
    def generate():
        for token in stream_generate_suggestions(latest_input["message"], latest_input["tone"]):
            yield f"data: {token}\n\n"
            sys.stdout.flush()
        yield "data: [DONE]\n\n"
        sys.stdout.flush()

    return Response(generate(), mimetype="text/event-stream", headers={
        "Cache-Control": "no-cache",
        "X-Accel-Buffering": "no",
        "Transfer-Encoding": "chunked",
        "Connection": "keep-alive",
        "Access-Control-Allow-Origin": "*",
    })


# ------------------------------------------------------------
# 5️⃣ 오타·문법 탐지 (일괄 응답)
# ------------------------------------------------------------
@app.route("/detect", methods=["POST"])
def detect():
    """오타·문법 탐지 및 수정 제안"""
    data = request.json or {}
    user_input = data.get("message", "")
    tone = data.get("tone", "자동 감지")

    result = detect_errors(user_input, tone)
    return jsonify(result)


# ------------------------------------------------------------
# 6️⃣ 새로운 기능: 문장 제안 (스트리밍 전용)
# ------------------------------------------------------------
@app.route("/suggest-streamed", methods=["GET"])
def suggest_streamed():
    """
    새롭게 추가된 문장 제안 스트리밍 기능.
    기존 일괄 방식(generate_suggestions)과 다르게,
    generate_suggestions_streamed()를 통해 토큰 단위로 실시간 전송.
    """
    def generate():
        for token in generate_suggestions_streamed(latest_input["message"], latest_input["tone"]):
            yield f"data: {token}\n\n"
            sys.stdout.flush()
        yield "data: [DONE]\n\n"
        sys.stdout.flush()

    return Response(generate(), mimetype="text/event-stream", headers={
        "Cache-Control": "no-cache",
        "X-Accel-Buffering": "no",
        "Transfer-Encoding": "chunked",
        "Connection": "keep-alive",
        "Access-Control-Allow-Origin": "*",
    })


# ------------------------------------------------------------
# 7️⃣ Gevent 서버 실행 (Windows 호환)
# ------------------------------------------------------------
if __name__ == "__main__":
    from gevent import pywsgi
    from gevent.monkey import patch_all

    patch_all()

    server = pywsgi.WSGIServer(("127.0.0.1", 5000), app)
    print("✅ Gevent WSGIServer running on http://127.0.0.1:5000")
    server.serve_forever()
