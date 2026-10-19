import {
  Activity,
  FileText,
  Globe,
  HeartPulse,
  LayoutDashboard,
  type LucideIcon,
  MonitorSmartphone,
  MousePointerClick,
  Radio,
  Target,
} from "lucide-react";
import type { MessageKey } from "../shared/lib/i18n";

// Report sections of a project (spec §13.3). Order = navigation order. The first four are the
// mobile tab bar; the rest open from "More" (design system §2).
export const SECTIONS = [
  { id: "overview", label: "nav.overview", icon: LayoutDashboard },
  { id: "realtime", label: "nav.realtime", icon: Radio },
  { id: "pages", label: "nav.pages", icon: FileText },
  { id: "sources", label: "nav.sources", icon: Activity },
  { id: "geo", label: "nav.geo", icon: Globe },
  { id: "devices", label: "nav.devices", icon: MonitorSmartphone },
  { id: "events", label: "nav.events", icon: MousePointerClick },
  { id: "goals", label: "nav.goals", icon: Target },
  { id: "data-health", label: "nav.dataHealth", icon: HeartPulse },
] as const satisfies readonly { id: string; label: MessageKey; icon: LucideIcon }[];

export type Section = (typeof SECTIONS)[number];
export const TAB_COUNT = 4;

export const findSection = (id: string | undefined): Section | undefined =>
  SECTIONS.find((section) => section.id === id);

/** Keeps the search params (range, filters) when switching sections (spec §13.4). */
export const sectionHref = (projectId: string, section: Section, search: string): string =>
  `/projects/${encodeURIComponent(projectId)}/${section.id}${search}`;
