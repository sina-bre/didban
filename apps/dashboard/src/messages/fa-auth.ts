import type { Messages } from "../shared/lib/i18n";
import type enAuth from "./en-auth";

const faAuth: Pick<Messages, keyof typeof enAuth> = {
  "auth.login.title": "ورود",
  "auth.login.intro": "با ایمیل و رمزی که مالک یا مدیر به شما داده وارد شوید.",
  "auth.email": "ایمیل",
  "auth.email.invalid": "یک نشانی ایمیل معتبر وارد کنید.",
  "auth.password": "رمز عبور",
  "auth.password.required": "رمز عبور را وارد کنید.",
  "auth.login.submit": "ورود",
  "auth.busy": "لطفاً صبر کنید…",
  "auth.error.invalid": "ایمیل یا رمز عبور نادرست است.",
  "auth.error.rateLimited": "تلاش‌ها بیش از حد بود. یک دقیقه صبر کنید و دوباره امتحان کنید.",
  "auth.set.title": "رمز عبور خود را انتخاب کنید",
  "auth.set.intro": "با رمز موقت وارد شده‌اید. برای ادامه رمز خودتان را انتخاب کنید.",
  "auth.set.current": "رمز موقت",
  "auth.set.new": "رمز عبور جدید",
  "auth.set.hint": "{min} تا {max} نویسه. رمزهای رایج پذیرفته نمی‌شوند.",
  "auth.set.confirm": "تکرار رمز عبور جدید",
  "auth.set.mismatch": "رمزها یکسان نیستند.",
  "auth.set.submit": "ذخیره رمز",
  "auth.set.currentWrong": "رمز موقت نادرست است.",
  "auth.set.PASSWORD_TOO_SHORT": "دست‌کم {min} نویسه به کار ببرید.",
  "auth.set.PASSWORD_TOO_LONG": "حداکثر {max} نویسه به کار ببرید.",
  "auth.set.PASSWORD_TOO_COMMON": "این رمز خیلی رایج است. رمز دیگری انتخاب کنید.",
  "auth.set.PASSWORD_UNCHANGED": "رمزی متفاوت با رمز موقت انتخاب کنید.",
};

export default faAuth;
