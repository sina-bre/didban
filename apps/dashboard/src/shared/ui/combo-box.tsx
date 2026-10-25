import { Check, ChevronDown } from "lucide-react";
import {
  ComboBox as AriaComboBox,
  Button,
  Input,
  Label,
  ListBox,
  ListBoxItem,
  Popover,
  useFilter,
} from "react-aria-components/ComboBox";

export interface ComboOption {
  id: string;
  label: string;
}

interface Props {
  label: string;
  options: readonly ComboOption[];
  onSelect: (id: string) => void;
  /** Shown when nothing matches the typed text. */
  emptyLabel: string;
}

/**
 * Searchable single choice on React Aria Components (ADR 0004: one of the two RAC widgets).
 * Lazy-load it (`lazy(() => import(...))`) so RAC stays out of the initial bundle.
 */
export default function ComboBox({ label, options, onSelect, emptyLabel }: Props) {
  const { contains } = useFilter({ sensitivity: "base" });
  return (
    <AriaComboBox
      defaultFilter={contains}
      defaultItems={options}
      menuTrigger="focus"
      onSelectionChange={(key) => key !== null && onSelect(String(key))}
      className="flex min-w-0 flex-col gap-1"
    >
      <Label className="text-body font-medium">{label}</Label>
      <div className="flex min-h-11 items-center rounded-control border border-line bg-surface focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-focus">
        <Input className="min-h-11 min-w-0 flex-1 bg-transparent px-3 text-body outline-none" />
        <Button className="flex size-11 items-center justify-center text-muted">
          <ChevronDown aria-hidden="true" className="size-4" />
        </Button>
      </div>
      <Popover className="w-(--trigger-width) overflow-auto rounded-panel bg-surface p-1 text-ink shadow-pop">
        <ListBox<ComboOption>
          renderEmptyState={() => <p className="px-3 py-2 text-body text-muted">{emptyLabel}</p>}
          className="outline-none"
        >
          {(item) => (
            <ListBoxItem
              id={item.id}
              textValue={item.label}
              className="flex min-h-11 cursor-default items-center justify-between gap-2 rounded-control px-3 text-body outline-none data-focused:bg-subtle"
            >
              {({ isSelected }) => (
                <>
                  <span className="truncate">{item.label}</span>
                  {isSelected && <Check aria-hidden="true" className="size-4" />}
                </>
              )}
            </ListBoxItem>
          )}
        </ListBox>
      </Popover>
    </AriaComboBox>
  );
}
