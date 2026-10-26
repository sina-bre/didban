import type { Messages } from "../shared/lib/i18n";
import type enReports from "./en-reports";

const faReports: Pick<Messages, keyof typeof enReports> = {
  "projects.none.title": "هنوز پروژه‌ای نیست",
  "projects.none.body": "هنوز به هیچ پروژه‌ای دسترسی ندارید. از مالک یا مدیر دسترسی بخواهید.",
  "metric.visitors": "بازدیدکننده",
  "metric.visits": "بازدید",
  "metric.pageviews": "نمایش صفحه",
  "metric.viewsPerVisit": "نمایش در هر بازدید",
  "metric.bounceRate": "نرخ پرش",
  "metric.visitDuration": "مدت بازدید",
  "overview.kpis": "شاخص‌های اصلی",
  "overview.chart": "بازدیدکنندگان در طول زمان",
  "overview.compare": "مقایسه با دوره قبل",
  "overview.channels": "کانال‌ها",
  "overview.cookieless":
    "حالت بدون کوکی: بازدیدکننده‌ای که روز دیگری برگردد دوباره شمرده می‌شود، پس جمع چندروزه بیشتر از واقع است.",
  "realtime.active": "بازدیدکنندگان فعال",
  "realtime.activeHint": "۵ دقیقه گذشته · به‌روزرسانی هر ۱۰ ثانیه",
  "realtime.perMinute": "نمایش صفحه در هر دقیقه، ۳۰ دقیقه گذشته",
  "realtime.pages": "صفحه‌های فعال",
  "realtime.sources": "منابع برتر",
  "realtime.recent": "رویدادهای اخیر",
  "realtime.time": "زمان",
  "realtime.event": "رویداد",
  "realtime.path": "صفحه",
  "realtime.visitors": "بازدیدکننده",
  "realtime.visits": "بازدید",
  "realtime.pageview": "نمایش صفحه",
  "realtime.none": "در ۳۰ دقیقه گذشته چیزی ثبت نشده.",
};

export default faReports;
