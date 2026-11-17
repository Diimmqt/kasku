import {
  useLayoutEffect,
  useRef,
  type ChangeEvent,
  type InputHTMLAttributes,
} from 'react';
import {
  formatAmountDots,
  parseAmountDots,
  stripTrailingDecimalZeros,
} from '../../lib/format';

interface AmountInputProps
  extends Omit<
    InputHTMLAttributes<HTMLInputElement>,
    'type' | 'value' | 'onChange'
  > {
  label?: string;
  error?: string;
  hint?: string;
  value: string;
  onValueChange: (canonicalValue: string) => void;
  prefixText?: string;
}

export function AmountInput({
  label,
  error,
  hint,
  id,
  className = '',
  value,
  onValueChange,
  prefixText,
  placeholder = '0',
  ...props
}: AmountInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const pendingCaretDigitCount = useRef<number | null>(null);

  const normalizedValue = value.endsWith('.')
    ? value
    : stripTrailingDecimalZeros(value);
  const displayValue = formatAmountDots(normalizedValue);
  const inputId = id ?? props.name;

  useLayoutEffect(() => {
    const el = inputRef.current;
    const targetDigits = pendingCaretDigitCount.current;
    if (!el || targetDigits === null) return;

    pendingCaretDigitCount.current = null;
    if (document.activeElement !== el) return;

    let seen = 0;
    let nextPos = displayValue.length;
    for (let i = 0; i < displayValue.length; i += 1) {
      if (seen >= targetDigits) {
        nextPos = i;
        break;
      }
      if (/[\d,]/.test(displayValue[i])) {
        seen += 1;
      }
    }
    if (seen >= targetDigits && targetDigits === 0) {
      nextPos = 0;
    }
    el.setSelectionRange(nextPos, nextPos);
  }, [displayValue]);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const rawTyped = e.target.value;
    const caret = e.target.selectionStart ?? rawTyped.length;
    let significantBeforeCaret = 0;
    for (let i = 0; i < caret; i += 1) {
      if (/[\d,]/.test(rawTyped[i])) {
        significantBeforeCaret += 1;
      }
    }
    pendingCaretDigitCount.current = significantBeforeCaret;

    const canonical = parseAmountDots(rawTyped);
    onValueChange(canonical);
  };

  return (
    <div className="space-y-1.5">
      {label && (
        <label
          htmlFor={inputId}
          className="block text-sm font-medium text-slate-700 dark:text-slate-200"
        >
          {label}
        </label>
      )}
      <div className="relative flex items-center">
        {prefixText && (
          <span className="pointer-events-none absolute left-3.5 text-sm font-medium text-slate-400">
            {prefixText}
          </span>
        )}
        <input
          ref={inputRef}
          id={inputId}
          type="text"
          inputMode="decimal"
          value={displayValue}
          onChange={handleChange}
          placeholder={placeholder}
          className={`w-full rounded-xl border bg-white py-2.5 pr-3.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 dark:bg-slate-950 dark:text-slate-100 ${
            prefixText ? 'pl-11' : 'px-3.5'
          } ${
            error
              ? 'border-red-400 focus:border-red-500 focus:ring-red-200'
              : 'border-slate-200 focus:border-emerald-600 focus:ring-emerald-500/20 dark:border-slate-700'
          } ${className}`}
          {...props}
        />
      </div>
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
      {!error && hint && (
        <p className="text-xs text-slate-500 dark:text-slate-400">{hint}</p>
      )}
    </div>
  );
}

