from supabase import create_client, Client
import os
from dotenv import load_dotenv

load_dotenv()

supabase_url = os.getenv("SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

# 환경 변수가 없어도 에러를 발생시키지 않고 None으로 설정
# 사용 시점에 체크하도록 변경
if not supabase_url or not supabase_key:
    print("[경고] Supabase 환경 변수가 설정되지 않았습니다. Supabase 기능이 비활성화됩니다.")
    print("[경고] .env 파일에 SUPABASE_URL과 SUPABASE_SERVICE_ROLE_KEY를 추가하세요.")
    supabase: Client | None = None
else:
    supabase: Client = create_client(supabase_url, supabase_key)