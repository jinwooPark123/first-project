import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY

console.log("Supabase 환경 변수 확인:");
console.log("REACT_APP_SUPABASE_URL:", supabaseUrl ? "설정됨" : "❌ 설정 안됨");
console.log("REACT_APP_SUPABASE_ANON_KEY:", supabaseAnonKey ? "설정됨" : "❌ 설정 안됨");

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("⚠️ Supabase 환경 변수가 설정되지 않았습니다!");
  console.error("frontend/.env 파일을 생성하고 다음 내용을 추가하세요:");
  console.error("REACT_APP_SUPABASE_URL=https://your-project.supabase.co");
  console.error("REACT_APP_SUPABASE_ANON_KEY=your_anon_key");
  // 에러를 던지지 않고 경고만 표시 (개발 중 테스트 가능하도록)
  // throw new Error('Supabase 환경 변수가 설정되지 않았습니다.')
}

// 환경 변수가 없어도 클라이언트는 생성하되, 사용 시 에러가 발생하도록
export const supabase = supabaseUrl && supabaseAnonKey 
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null