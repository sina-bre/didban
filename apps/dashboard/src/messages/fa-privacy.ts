import type { Messages } from "../shared/lib/i18n";
import type enPrivacy from "./en-privacy";

const faPrivacy: Pick<Messages, keyof typeof enPrivacy> = {
  "deletion.title": "حذف داده",
  "deletion.intro":
    "رویدادها و بازدیدهای ذخیره‌شده را برای همیشه پاک می‌کند. یک کار پس‌زمینه این کار را مرحله‌به‌مرحله انجام می‌دهد و گزارش‌ها در همین حین تغییر می‌کنند.",
  "deletion.kind": "حذف بر اساس",
  "deletion.kind.range": "بازهٔ تاریخ",
  "deletion.kind.visitor": "بازدیدکننده",
  "deletion.kind.user": "شناسهٔ کاربر",
  "deletion.from": "روز اول",
  "deletion.to": "روز آخر",
  "deletion.rangeHint": "روزهای کامل در منطقهٔ زمانی پروژه، هر دو روز شامل می‌شوند.",
  "deletion.anonymousId": "شناسهٔ ناشناس",
  "deletion.anonymousIdHint":
    "مقدار didban_aid در حافظهٔ مرورگر بازدیدکننده (فقط در حالت ماندگار). بازدیدکنندگان بدون کوکی را نمی‌توان جدا کرد.",
  "deletion.userId": "شناسهٔ کاربر",
  "deletion.userIdHint":
    "همان که با identify فرستاده شده. بقیهٔ بازدیدهایی را هم که در آن‌ها آمده پاک می‌کند.",
  "deletion.invalid.range": "روز اول باید همان روز آخر یا پیش از آن باشد.",
  "deletion.invalid.id": "۱ تا ۱۲۸ نویسه وارد کنید.",
  "deletion.submit": "حذف داده",
  "deletion.confirmTitle": "این داده حذف شود؟",
  "deletion.confirmBody":
    "این کار برگشت‌پذیر نیست. رویدادها و بازدیدهای حذف‌شده از همهٔ گزارش‌ها می‌روند.",
  "deletion.confirm": "حذف برای همیشه",
  "deletion.none.title": "هنوز حذفی نیست",
  "deletion.none.body": "درخواست‌ها و پیشرفتشان اینجا نشان داده می‌شوند.",
  "deletion.what": "چه چیزی",
  "deletion.requested": "زمان درخواست",
  "deletion.status": "وضعیت",
  "deletion.deleted": "حذف‌شده",
  "deletion.visitorTarget": "یک بازدیدکننده",
  "deletion.counts": "{events} رویداد · {visits} بازدید",
  "deletion.status.pending": "در انتظار",
  "deletion.status.running": "در حال اجرا",
  "deletion.status.done": "انجام شد",
  "deletion.status.failed": "ناموفق",
  "error.DELETION_LIMIT_REACHED": "این پروژه ۱۰ حذف باز دارد. صبر کنید تا تمام شوند.",
};

export default faPrivacy;
