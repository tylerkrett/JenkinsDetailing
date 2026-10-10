"use client";

import { useCallback, useId, useRef, useState, type FormEvent } from "react";

import { cn } from "~/lib/cn";
import type { Service, VehicleSize, Where } from "~/lib/content";
import { quoteInputSchema } from "~/lib/content/schema";
import { telHref, whatsappHref } from "~/lib/format";
import { api } from "~/trpc/react";

import { inputClass, labelClass, primaryButtonClass, secondaryButtonClass } from "./styles";
import { Turnstile, turnstileEnabled } from "./turnstile";

type Field = "name" | "email" | "phone" | "vehicle" | "size" | "where" | "postcode" | "message";
type FieldErrors = Partial<Record<Field, string>>;

export type QuoteFormProps = {
  /** Every published service, for the select. */
  services: Pick<Service, "slug" | "title">[];
  /** Preselected service, if the form was opened from a service page. */
  service?: string;
  /** Public contact details shown as a fallback when sending fails. */
  contact?: { email: string; phone: string; phoneDigits: string };
  onSuccess?: () => void;
  onClose?: () => void;
  className?: string;
};

const FIELD_ORDER: Field[] = ["name", "email", "phone", "vehicle", "size", "where", "postcode", "message"];

const SIZES: { value: VehicleSize; label: string }[] = [
  { value: "small", label: "Small car" },
  { value: "medium", label: "Medium car" },
  { value: "large", label: "Large car or SUV" },
  { value: "van", label: "Van" },
];
const WHERES: { value: Where; label: string }[] = [
  { value: "unit", label: "At the unit in Tregaron" },
  { value: "mobile", label: "At my address" },
];

function messageFor(field: Field, code: string): string {
  switch (field) {
    case "name":
      return code === "too_big" ? "Keep your name under 120 characters." : "Add your name.";
    case "email":
      return "Enter a valid email address.";
    case "phone":
      return "Keep the phone number under 40 characters.";
    case "vehicle":
      return code === "too_big" ? "Keep it under 120 characters." : "Tell us the make and model.";
    case "size":
      return "Pick a size.";
    case "where":
      return "Tell us where the work would be done.";
    case "postcode":
      return "Keep the postcode under 12 characters.";
    case "message":
      return code === "too_big"
        ? "Keep the message under 4,000 characters."
        : "Write a few more words about what the car needs. Ten characters is the minimum.";
  }
}

function isField(value: unknown): value is Field {
  return FIELD_ORDER.includes(value as Field);
}

export function QuoteForm({ services, service, contact, onSuccess, onClose, className }: QuoteFormProps) {
  const id = useId();
  const ids = Object.fromEntries([...FIELD_ORDER, "service", "website", "status"].map((f) => [f, `${id}-${f}`])) as Record<
    Field | "service" | "website" | "status",
    string
  >;

  const [values, setValues] = useState({
    service: service ?? "",
    name: "",
    email: "",
    phone: "",
    vehicle: "",
    size: "" as VehicleSize | "",
    where: "" as Where | "",
    postcode: "",
    message: "",
    website: "",
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [sent, setSent] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const onToken = useCallback((t: string | null) => setToken(t), []);

  const refs = {
    name: useRef<HTMLInputElement>(null),
    email: useRef<HTMLInputElement>(null),
    phone: useRef<HTMLInputElement>(null),
    vehicle: useRef<HTMLInputElement>(null),
    size: useRef<HTMLInputElement>(null),
    where: useRef<HTMLInputElement>(null),
    postcode: useRef<HTMLInputElement>(null),
    message: useRef<HTMLTextAreaElement>(null),
  };

  const submit = api.quote.submit.useMutation();
  const fallback = api.quote.contact.useQuery(undefined, {
    enabled: contact === undefined && submit.isError,
    staleTime: Infinity,
  });
  const fb = contact ?? fallback.data;

  function update(field: keyof typeof values, value: string) {
    setValues((v) => ({ ...v, [field]: value }));
    if (isField(field) && errors[field]) setErrors((e) => ({ ...e, [field]: undefined }));
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submit.isPending) return;

    const parsed = quoteInputSchema.safeParse({
      service: values.service || undefined,
      name: values.name,
      email: values.email,
      phone: values.phone || undefined,
      vehicle: values.vehicle,
      size: values.size,
      where: values.where,
      postcode: values.postcode || undefined,
      message: values.message,
    });

    if (!parsed.success) {
      const next: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0];
        if (isField(field) && !next[field]) next[field] = messageFor(field, issue.code);
      }
      setErrors(next);
      const first = FIELD_ORDER.find((f) => next[f]);
      if (first) refs[first].current?.focus();
      return;
    }

    setErrors({});
    submit.mutate(
      { ...parsed.data, website: values.website, turnstileToken: token ?? undefined },
      {
        onSuccess: () => {
          setSent(true);
          onSuccess?.();
        },
      },
    );
  }

  if (sent) {
    return (
      <div role="status" className={cn("flex flex-col items-start gap-6", className)}>
        <p className="max-w-[40ch]">Sent. We reply with a price and the earliest date, usually the same day.</p>
        {onClose ? (
          <button type="button" onClick={onClose} className={primaryButtonClass}>
            Close
          </button>
        ) : null}
      </div>
    );
  }

  const serverMessage =
    submit.error?.data?.code === "INTERNAL_SERVER_ERROR" ||
    submit.error?.data?.code === "TOO_MANY_REQUESTS" ||
    submit.error?.data?.code === "BAD_REQUEST"
      ? submit.error.message
      : "The request could not be sent. Check your connection and try again.";

  const errorLine = (field: Field) => (
    <p id={`${ids[field]}-error`} aria-live="polite" className="text-accent mt-1.5 min-h-5 text-sm">
      {errors[field]}
    </p>
  );

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className={cn("relative flex flex-col gap-5", className)}
      aria-describedby={submit.isError ? ids.status : undefined}
    >
      <fieldset>
        <legend className={labelClass}>Service</legend>
        <div className="flex flex-wrap gap-2">
          {[{ slug: "", title: "Not sure yet" }, ...services].map((s) => (
            <label className="choice-label" key={s.slug}>
              <input
                type="radio"
                name="service"
                value={s.slug}
                checked={values.service === s.slug}
                onChange={() => update("service", s.slug)}
              />
              <span>{s.title}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor={ids.name} className={labelClass}>
            Name
          </label>
          <input
            ref={refs.name}
            id={ids.name}
            name="name"
            type="text"
            autoComplete="name"
            value={values.name}
            onChange={(e) => update("name", e.target.value)}
            aria-invalid={errors.name ? true : undefined}
            aria-describedby={`${ids.name}-error`}
            className={inputClass}
          />
          {errorLine("name")}
        </div>
        <div>
          <label htmlFor={ids.phone} className={labelClass}>
            Phone
          </label>
          <input
            ref={refs.phone}
            id={ids.phone}
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={values.phone}
            onChange={(e) => update("phone", e.target.value)}
            aria-invalid={errors.phone ? true : undefined}
            aria-describedby={`${ids.phone}-error`}
            className={inputClass}
          />
          {errorLine("phone")}
        </div>
      </div>

      <div>
        <label htmlFor={ids.email} className={labelClass}>
          Email
        </label>
        <input
          ref={refs.email}
          id={ids.email}
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          spellCheck={false}
          value={values.email}
          onChange={(e) => update("email", e.target.value)}
          aria-invalid={errors.email ? true : undefined}
          aria-describedby={`${ids.email}-error`}
          className={inputClass}
        />
        {errorLine("email")}
      </div>

      <div>
        <label htmlFor={ids.vehicle} className={labelClass}>
          Vehicle
        </label>
        <input
          ref={refs.vehicle}
          id={ids.vehicle}
          name="vehicle"
          type="text"
          autoComplete="off"
          placeholder="Make and model"
          value={values.vehicle}
          onChange={(e) => update("vehicle", e.target.value)}
          aria-invalid={errors.vehicle ? true : undefined}
          aria-describedby={`${ids.vehicle}-error`}
          className={inputClass}
        />
        {errorLine("vehicle")}
      </div>

      {(
        [
          { field: "size", label: "Size", options: SIZES },
          { field: "where", label: "Where", options: WHERES },
        ] as const
      ).map(({ field, label, options }) => (
        <fieldset key={field} aria-describedby={`${ids[field]}-error`}>
          <legend className={labelClass}>{label}</legend>
          <div className="flex flex-wrap gap-2">
            {options.map((option, index) => (
              <label key={option.value} className="choice-label">
                <input
                  ref={index === 0 ? refs[field] : undefined}
                  type="radio"
                  name={field}
                  value={option.value}
                  checked={values[field] === option.value}
                  onChange={() => update(field, option.value)}
                  aria-describedby={`${ids[field]}-error`}
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
          {errorLine(field)}
        </fieldset>
      ))}

      {values.where === "mobile" ? (
        <div>
          <label htmlFor={ids.postcode} className={labelClass}>
            Postcode
          </label>
          <input
            ref={refs.postcode}
            id={ids.postcode}
            name="postcode"
            type="text"
            autoComplete="postal-code"
            value={values.postcode}
            onChange={(e) => update("postcode", e.target.value)}
            aria-invalid={errors.postcode ? true : undefined}
            aria-describedby={`${ids.postcode}-error`}
            className={cn(inputClass, "max-w-[12ch] uppercase")}
          />
          {errorLine("postcode")}
        </div>
      ) : null}

      <div>
        <label htmlFor={ids.message} className={labelClass}>
          What does it need?
        </label>
        <textarea
          ref={refs.message}
          id={ids.message}
          name="message"
          rows={4}
          autoComplete="off"
          value={values.message}
          onChange={(e) => update("message", e.target.value)}
          aria-invalid={errors.message ? true : undefined}
          aria-describedby={`${ids.message}-error`}
          className={cn(inputClass, "resize-y")}
        />
        {errorLine("message")}
      </div>

      {/* Honeypot. Hidden from people and assistive tech; bots fill it and get a quiet "sent". */}
      <div aria-hidden="true" className="absolute top-0 -left-[9999px] h-px w-px overflow-hidden">
        <label htmlFor={ids.website}>Website</label>
        <input
          id={ids.website}
          name="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={values.website}
          onChange={(e) => update("website", e.target.value)}
        />
      </div>

      <Turnstile onToken={onToken} />

      <div className="flex flex-wrap items-center gap-4 pt-1">
        <button
          type="submit"
          disabled={submit.isPending || (turnstileEnabled && !token)}
          aria-busy={submit.isPending || undefined}
          className={primaryButtonClass}
        >
          {submit.isPending ? "Sending…" : "Request a quote"}
        </button>
        {onClose ? (
          <button type="button" onClick={onClose} className={secondaryButtonClass}>
            Cancel
          </button>
        ) : null}
      </div>

      <p id={ids.status} role="alert" className="text-bone/80 min-h-5 text-sm">
        {submit.isError ? (
          <>
            {serverMessage}
            {fb ? (
              <>
                {" "}
                Or{" "}
                <a href={telHref(fb.phoneDigits)} className="text-accent underline underline-offset-4">
                  call {fb.phone}
                </a>
                ,{" "}
                <a
                  href={whatsappHref(fb.phoneDigits)}
                  target="_blank"
                  rel="noreferrer"
                  className="text-accent underline underline-offset-4"
                >
                  WhatsApp
                </a>{" "}
                or email{" "}
                <a href={`mailto:${fb.email}`} className="text-accent underline underline-offset-4">
                  {fb.email}
                </a>
                .
              </>
            ) : null}
          </>
        ) : null}
      </p>
    </form>
  );
}
