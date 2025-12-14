from flask import Flask, Response, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
import os
import sys
import requests
from ai_handler import (
    stream_predict_text,
    stream_generate_suggestions,
    generate_suggestions,
    detect_errors,
    generate_suggestions_streamed,  # ✅ 새 함수 추가
    summarize_text,  # ✅ 요약 기능 추가
    polish_text,  # ✅ 텍스트 다듬기 기능 추가
    correct_spacing,  # ✅ 띄어쓰기 교정 기능 추가
)
# Supabase 추가 (선택적)
try:
    from supabase_client import supabase
except Exception as e:
    print(f"[경고] Supabase 클라이언트를 불러올 수 없습니다: {e}")
    supabase = None

from datetime import datetime

# ------------------------------------------------------------
# 환경 변수 로드
# ------------------------------------------------------------
load_dotenv()

app = Flask(__name__)
CORS(app, resources={r"/*": {
    "origins": "*",
    "methods": ["GET", "POST", "OPTIONS"],
    "allow_headers": ["Content-Type", "Authorization"]
}})

api_key = os.getenv("OPENAI_API_KEY")
if not api_key:
    print("[경고] OPENAI_API_KEY가 .env에서 감지되지 않았습니다.")


# ------------------------------------------------------------
# 1️⃣ 최신 입력 데이터 임시 저장
# ------------------------------------------------------------
latest_input = {"message": "", "tone": "자동 감지"}


@app.route("/stream", methods=["POST", "OPTIONS"])
def stream_post():
    """React에서 입력 데이터를 받아 저장"""
    if request.method == "OPTIONS":
        return "", 200
    
    try:
        data = request.json or {}
        latest_input["message"] = data.get("message", "")
        latest_input["tone"] = data.get("tone", "자동 감지")
        return jsonify({"status": "ready"})
    except Exception as e:
        print(f"[ERROR] /stream POST 에러: {str(e)}")
        return jsonify({"status": "error", "message": str(e)}), 500


# ------------------------------------------------------------
# 2️⃣ 실시간 예측 (AI Cursor)
# ------------------------------------------------------------
@app.route("/stream-events", methods=["GET"])
def stream_events():
    """문장 입력 중 실시간 예측 스트리밍"""
    def generate():
        try:
            if not latest_input["message"] or not latest_input["message"].strip():
                yield f"data: [ERROR] 입력 텍스트가 비어있습니다.\n\n"
                yield "data: [DONE]\n\n"
                return

            for token in stream_predict_text(latest_input["message"], latest_input["tone"]):
                if token.startswith("[ERROR]"):
                    yield f"data: {token}\n\n"
                    break
                yield f"data: {token}\n\n"
                sys.stdout.flush()
            yield "data: [DONE]\n\n"
            sys.stdout.flush()
        except Exception as e:
            print(f"[ERROR] stream_events 에러: {str(e)}")
            yield f"data: [ERROR] 스트리밍 오류: {str(e)}\n\n"
            yield "data: [DONE]\n\n"
            sys.stdout.flush()

    return Response(generate(), mimetype="text/event-stream", headers={
        "Cache-Control": "no-cache",
        "X-Accel-Buffering": "no",
        "Transfer-Encoding": "chunked",
        "Connection": "keep-alive",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
    })


# ------------------------------------------------------------
# 3️⃣ 문장 제안 (일괄 응답)
# ------------------------------------------------------------
@app.route("/suggest", methods=["POST", "OPTIONS"])
def suggest():
    if request.method == "OPTIONS":
        return "", 200
    """문장 제안 (일괄 응답)"""
    try:
        data = request.json or {}
        user_input = data.get("message", "")
        tone = data.get("tone", "자동 감지")

        # 입력 검증
        if not user_input or not user_input.strip():
            return jsonify({
                "error": "입력 텍스트가 비어있습니다.",
                "suggestions": ""
            }), 400

        suggestions = generate_suggestions(user_input, tone)
        return jsonify({
            "suggestions": suggestions,
            "error": None
        })
    except Exception as e:
        print(f"[ERROR] /suggest 에러: {str(e)}")
        return jsonify({
            "error": f"서버 오류: {str(e)}",
            "suggestions": ""
        }), 500


# ------------------------------------------------------------
# 4️⃣ 실시간 문장 제안 (SSE) - 문장 번호 부여
# ------------------------------------------------------------
@app.route("/suggest-stream", methods=["GET"])
def suggest_stream():
    """문장 제안 (SSE) - 문장 번호 및 가독성 강화"""
    def generate():
        try:
            if not latest_input["message"] or not latest_input["message"].strip():
                yield f"data: [ERROR] 입력 텍스트가 비어있습니다.\n\n"
                yield "data: [DONE]\n\n"
                return

            for token in stream_generate_suggestions(latest_input["message"], latest_input["tone"]):
                if token.startswith("[ERROR]"):
                    yield f"data: {token}\n\n"
                    break
                yield f"data: {token}\n\n"
                sys.stdout.flush()
            yield "data: [DONE]\n\n"
            sys.stdout.flush()
        except Exception as e:
            print(f"[ERROR] suggest_stream 에러: {str(e)}")
            yield f"data: [ERROR] 스트리밍 오류: {str(e)}\n\n"
            yield "data: [DONE]\n\n"
            sys.stdout.flush()

    return Response(generate(), mimetype="text/event-stream", headers={
        "Cache-Control": "no-cache",
        "X-Accel-Buffering": "no",
        "Transfer-Encoding": "chunked",
        "Connection": "keep-alive",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
    })


# ------------------------------------------------------------
# 5️⃣ 오타·문법 탐지 (일괄 응답)
# ------------------------------------------------------------
@app.route("/detect", methods=["POST", "OPTIONS"])
def detect():
    if request.method == "OPTIONS":
        return "", 200
    """오타·문법 탐지 및 수정 제안"""
    try:
        data = request.json or {}
        user_input = data.get("message", "")
        tone = data.get("tone", "자동 감지")

        # 입력 검증
        if not user_input or not user_input.strip():
            return jsonify({
                "error": "입력 텍스트가 비어있습니다.",
                "errors": [],
                "summary": "입력 텍스트가 필요합니다."
            }), 400

        result = detect_errors(user_input, tone)
        # result가 이미 dict 형식이므로 그대로 반환
        if not isinstance(result, dict):
            result = {"error": "응답 형식 오류", "errors": [], "summary": str(result)}
        return jsonify(result)
    except Exception as e:
        print(f"[ERROR] /detect 에러: {str(e)}")
        return jsonify({
            "error": f"서버 오류: {str(e)}",
            "errors": [],
            "summary": "오타·문법 탐지 중 오류가 발생했습니다."
        }), 500


# ------------------------------------------------------------
# 6️⃣ 텍스트 요약 기능
# ------------------------------------------------------------
@app.route("/summarize", methods=["POST", "OPTIONS"])
def summarize():
    if request.method == "OPTIONS":
        return "", 200
    """텍스트 요약 기능"""
    try:
        data = request.json or {}
        user_input = data.get("message", "")
        tone = data.get("tone", "자동 감지")

        # 입력 검증
        if not user_input or not user_input.strip():
            return jsonify({
                "error": "입력 텍스트가 비어있습니다.",
                "summary": ""
            }), 400

        result = summarize_text(user_input, tone)
        return jsonify(result)
    except Exception as e:
        print(f"[ERROR] /summarize 에러: {str(e)}")
        return jsonify({
            "error": f"서버 오류: {str(e)}",
            "summary": ""
        }), 500


# ------------------------------------------------------------
# 7️⃣ 텍스트 다듬기 기능
# ------------------------------------------------------------
@app.route("/polish", methods=["POST", "OPTIONS"])
def polish():
    if request.method == "OPTIONS":
        return "", 200
    """텍스트 다듬기 기능 - 문장을 자연스럽게 연결하고 개선"""
    try:
        data = request.json or {}
        user_input = data.get("message", "")
        tone = data.get("tone", "자동 감지")

        # 입력 검증
        if not user_input or not user_input.strip():
            return jsonify({
                "error": "다듬을 텍스트가 비어있습니다.",
                "polished": ""
            }), 400

        result = polish_text(user_input, tone)
        return jsonify(result)
    except Exception as e:
        print(f"[ERROR] /polish 에러: {str(e)}")
        return jsonify({
            "error": f"서버 오류: {str(e)}",
            "polished": ""
        }), 500


# ------------------------------------------------------------
# 8️⃣ 새로운 기능: 문장 제안 (스트리밍 전용)
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
# 8️⃣ 텍스트 히스토리 저장
# ------------------------------------------------------------
@app.route("/save-text", methods=["POST", "OPTIONS"])
def save_text():
    if request.method == "OPTIONS":
        return "", 200
    
    try:
        data = request.json or {}
        user_id = data.get("user_id")
        content = data.get("content", "")
        tone = data.get("tone", "자동 감지")
        
        if not user_id:
            return jsonify({"error": "user_id가 필요합니다."}), 400
        
        if not content or not content.strip():
            return jsonify({"error": "저장할 텍스트가 없습니다."}), 400
        
        # Supabase 체크
        if not supabase:
            return jsonify({"error": "Supabase가 설정되지 않았습니다. 환경 변수를 확인하세요."}), 503
        
        # 글자 수와 단어 수 계산
        char_count = len(content)
        word_count = len(content.split())
        
        # Supabase에 저장
        result = supabase.table("text_history").insert({
            "user_id": user_id,
            "content": content,
            "tone": tone,
            "char_count": char_count,
            "word_count": word_count
        }).execute()
        
        if result.data:
            return jsonify({
                "status": "success",
                "id": result.data[0]["id"],
                "message": "텍스트가 저장되었습니다."
            })
        else:
            return jsonify({"error": "저장 실패"}), 500
            
    except Exception as e:
        print(f"[ERROR] /save-text 에러: {str(e)}")
        return jsonify({"error": f"서버 오류: {str(e)}"}), 500


# ------------------------------------------------------------
# 9️⃣ 텍스트 히스토리 조회
# ------------------------------------------------------------
@app.route("/get-history/<user_id>", methods=["GET"])
def get_history(user_id):
    try:
        # Supabase 체크
        if not supabase:
            return jsonify({"error": "Supabase가 설정되지 않았습니다. 환경 변수를 확인하세요.", "data": []}), 503
        
        print(f"[INFO] /get-history 요청 - user_id: {user_id}")
        result = supabase.table("text_history")\
            .select("*")\
            .eq("user_id", user_id)\
            .order("created_at", desc=True)\
            .limit(50)\
            .execute()
        
        print(f"[INFO] 히스토리 조회 결과: {len(result.data) if result.data else 0}개")
        if result.data:
            print(f"[INFO] 첫 번째 항목: {result.data[0] if len(result.data) > 0 else '없음'}")
        
        return jsonify({
            "status": "success",
            "data": result.data if result.data else []
        })
    except Exception as e:
        print(f"[ERROR] /get-history 에러: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": f"서버 오류: {str(e)}"}), 500


# ------------------------------------------------------------
# 🔟 AI 제안 저장
# ------------------------------------------------------------
@app.route("/save-suggestion", methods=["POST", "OPTIONS"])
def save_suggestion():
    if request.method == "OPTIONS":
        return "", 200
    
    try:
        data = request.json or {}
        text_history_id = data.get("text_history_id")
        suggestion_text = data.get("suggestion_text", "")
        suggestion_type = data.get("suggestion_type", "suggestion")
        
        if not text_history_id or not suggestion_text:
            return jsonify({"error": "필수 필드가 누락되었습니다."}), 400
        
        # Supabase 체크
        if not supabase:
            return jsonify({"error": "Supabase가 설정되지 않았습니다. 환경 변수를 확인하세요."}), 503
        
        result = supabase.table("ai_suggestions").insert({
            "text_history_id": text_history_id,
            "suggestion_text": suggestion_text,
            "suggestion_type": suggestion_type
        }).execute()
        
        return jsonify({
            "status": "success",
            "id": result.data[0]["id"] if result.data else None
        })
    except Exception as e:
        print(f"[ERROR] /save-suggestion 에러: {str(e)}")
        return jsonify({"error": f"서버 오류: {str(e)}"}), 500


# ------------------------------------------------------------
# 9️⃣ 띄어쓰기 교정
# ------------------------------------------------------------
@app.route("/correct-spacing", methods=["POST", "OPTIONS"])
def correct_spacing_route():
    if request.method == "OPTIONS":
        return "", 200
    """띄어쓰기 교정 기능"""
    try:
        data = request.json or {}
        user_input = data.get("message", "")
        tone = data.get("tone", "자동 감지")

        if not user_input or not user_input.strip():
            return jsonify({
                "error": "입력 텍스트가 비어있습니다.",
                "corrected_text": ""
            }), 400

        result = correct_spacing(user_input, tone)
        return jsonify(result)
    except Exception as e:
        print(f"[ERROR] /correct-spacing 에러: {str(e)}")
        return jsonify({
            "error": f"서버 오류: {str(e)}",
            "corrected_text": ""
        }), 500




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
