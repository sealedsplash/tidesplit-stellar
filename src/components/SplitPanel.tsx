import { useMemo, useState } from "react";
import { computeSplit } from "../split/calculator";
import { validateSplitForm, type FormIssues } from "../split/validation";

interface Props {
  balanceXlm: string | null;
  locked: boolean;
  onSettle: (recipient: string, shareXlm: string) => void;
}

/**
 * Expense inputs, live calculation summary, and the settle control.
 * The displayed share is the exact amount passed to settlement.
 */
export function SplitPanel({ balanceXlm, locked, onSettle }: Props) {
  const [total, setTotal] = useState("");
  const [people, setPeople] = useState("4");
  const [roundUp, setRoundUp] = useState(false);
  const [recipient, setRecipient] = useState("");
  const [submittedOnce, setSubmittedOnce] = useState(false);

  const split = useMemo(
    () => computeSplit({ totalXlm: total, participants: Number.parseInt(people, 10), roundUpToWhole: roundUp }),
    [total, people, roundUp],
  );

  const issues: FormIssues = validateSplitForm(total, people, recipient, balanceXlm);
  const showIssues = submittedOnce || total !== "" || recipient !== "";
  const visible: FormIssues = showIssues ? issues : {};
  const canSubmit = !locked && Object.keys(issues).length === 0 && split !== null;

  function handleSettle(event: React.FormEvent) {
    event.preventDefault();
    setSubmittedOnce(true);
    if (!canSubmit || !split) return;
    onSettle(recipient.trim(), split.shareXlm);
  }

  return (
    <form className="panel" aria-labelledby="split-title" onSubmit={handleSettle} noValidate>
      <h2 className="panel-heading" id="split-title">
        Divide the expense
      </h2>

      <div className="field-row">
        <div className="field">
          <label htmlFor="ts-total">Total expense (XLM)</label>
          <input
            id="ts-total"
            className="input-ts"
            type="number"
            inputMode="decimal"
            min="0"
            step="0.0000001"
            placeholder="0.00"
            value={total}
            onChange={(event) => setTotal(event.target.value)}
            aria-invalid={Boolean(visible.total)}
            aria-describedby={visible.total ? "ts-total-issue" : undefined}
          />
          {visible.total && (
            <p className="issue" id="ts-total-issue" role="alert">
              {visible.total}
            </p>
          )}
        </div>

        <div className="field">
          <label htmlFor="ts-people">People sharing</label>
          <input
            id="ts-people"
            className="input-ts"
            type="number"
            inputMode="numeric"
            min="2"
            max="100"
            step="1"
            value={people}
            onChange={(event) => setPeople(event.target.value)}
            aria-invalid={Boolean(visible.participants)}
            aria-describedby={visible.participants ? "ts-people-issue" : undefined}
          />
          {visible.participants && (
            <p className="issue" id="ts-people-issue" role="alert">
              {visible.participants}
            </p>
          )}
        </div>
      </div>

      <label className="checkbox-row">
        <input
          type="checkbox"
          checked={roundUp}
          onChange={(event) => setRoundUp(event.target.checked)}
        />
        Round each share up to a whole number of XLM
      </label>

      <div className="field">
        <label htmlFor="ts-recipient">Recipient of this share</label>
        <input
          id="ts-recipient"
          className="input-ts mono"
          type="text"
          autoComplete="off"
          spellCheck={false}
          placeholder="G…"
          value={recipient}
          onChange={(event) => setRecipient(event.target.value)}
          aria-invalid={Boolean(visible.recipient)}
          aria-describedby={visible.recipient ? "ts-recipient-issue" : undefined}
        />
        {visible.recipient && (
          <p className="issue" id="ts-recipient-issue" role="alert">
            {visible.recipient}
          </p>
        )}
      </div>

      <div className="summary" aria-live="polite">
        {split ? (
          <>
            <p className="summary-line">
              Each person pays <strong>{split.shareXlm} XLM</strong>.
            </p>
            <p className="summary-note">
              Total {total || "0"} XLM · {people} people
              {split.remainderStroops > 0 && (
                <> · unassigned remainder {(split.remainderStroops / 10_000_000).toFixed(7)} XLM stays with you</>
              )}
            </p>
          </>
        ) : (
          <p className="summary-note">Enter a total and participant count to see each share.</p>
        )}
      </div>

      <button type="submit" className="btn-primary-ts btn-block" disabled={!canSubmit}>
        Settle my share{split ? ` (${split.shareXlm} XLM)` : ""}
      </button>
      {locked && (
        <p className="summary-note">Connect Freighter on Testnet to unlock settlement.</p>
      )}
    </form>
  );
}
