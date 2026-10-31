import { useLocale } from "../../shared/lib/locale-context";
import { Button } from "../../shared/ui";

/** The form-level error (announced) and the submit button. */
export function FormFooter({
  error,
  pending,
  label,
}: {
  error?: string;
  pending: boolean;
  label?: string;
}) {
  const { t } = useLocale();
  return (
    <div className="flex flex-col items-start gap-3">
      {error && (
        <p role="alert" className="text-body text-down">
          {error}
        </p>
      )}
      <Button type="submit" variant="primary" disabled={pending}>
        {label ?? t("settings.save")}
      </Button>
    </div>
  );
}
