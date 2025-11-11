"""
스트리밍 기능 테스트 스크립트
실제로 스트리밍이 작동하는지 확인할 수 있습니다.
"""
import os
from dotenv import load_dotenv
from ai_handler import stream_predict_text

# 환경 변수 로드
load_dotenv()

def test_streaming():
    """스트리밍 기능 테스트"""
    print("=" * 50)
    print("스트리밍 기능 테스트 시작")
    print("=" * 50)
    
    # 테스트 입력
    test_input = "오늘 날씨가 좋아서"
    test_tone = "논리적"
    
    print(f"\n입력 문장: {test_input}")
    print(f"문체 모드: {test_tone}")
    print("\n스트리밍 결과:")
    print("-" * 50)
    
    try:
        token_count = 0
        for token in stream_predict_text(test_input, test_tone):
            if token == "[DONE]":
                print("\n[DONE] - 스트리밍 완료")
                break
            if token.startswith("[ERROR]"):
                print(f"\n{token}")
                break
            print(token, end="", flush=True)
            token_count += 1
        
        print(f"\n\n총 {token_count}개의 토큰이 스트리밍되었습니다.")
        print("=" * 50)
        print("[성공] 테스트 성공!")
        
    except Exception as e:
        print(f"\n[실패] 테스트 실패: {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    # API 키 확인
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        print("[경고] OPENAI_API_KEY가 .env 파일에 설정되지 않았습니다.")
        print("테스트를 진행하지만 API 호출이 실패할 수 있습니다.\n")
    else:
        print("[확인] API 키가 설정되어 있습니다.\n")
    
    test_streaming()

