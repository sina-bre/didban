import { useParams } from "react-router";
import { findSection } from "../../app/sections";
import { useLocale } from "../../shared/lib/locale-context";
import { NotFoundPage } from "../not-found/page";
import { ReportHeader } from "./report-header";

/** Report frame for the reports whose bodies arrive in Stage 5d: title and range only. */
export function ReportPage() {
  const { t } = useLocale();
  const section = findSection(useParams().section);
  if (!section) return <NotFoundPage />;
  return <ReportHeader title={t(section.label)} />;
}
