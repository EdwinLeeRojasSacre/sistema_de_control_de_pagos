'use client';

import { useId, useState, type InputHTMLAttributes } from 'react';

interface PasswordVisibilityButtonProps {
  visible: boolean;
  onToggle(): void;
  controls?: string;
  className?: string;
}

export function PasswordVisibilityButton({ visible, onToggle, controls, className = '' }: PasswordVisibilityButtonProps) {
  return (
    <button
      type="button"
      aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
      aria-controls={controls}
      aria-pressed={visible}
      onClick={onToggle}
      className={className}
    >
      {visible ? <EyeOffIcon /> : <EyeIcon />}
    </button>
  );
}

interface PasswordFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
  inputClassName?: string;
}

export function PasswordField({ label, id, inputClassName = '', className = '', ...props }: PasswordFieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const [visible, setVisible] = useState(false);

  return (
    <div className={className}>
      {label && <label htmlFor={inputId} className="mb-2 block text-sm font-semibold text-slate-700">{label}</label>}
      <div className="relative">
        <input
          {...props}
          id={inputId}
          type={visible ? 'text' : 'password'}
          className={`${inputClassName} pr-12`}
        />
        <PasswordVisibilityButton
          visible={visible}
          onToggle={() => setVisible((current) => !current)}
          controls={inputId}
          className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-lg text-slate-500 transition hover:text-slate-800 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-red-700"
        />
      </div>
    </div>
  );
}

function EyeIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5"><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="2.5"/></svg>;
}

function EyeOffIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5"><path d="m3 3 18 18"/><path d="M10.6 6.2A10.7 10.7 0 0 1 12 6c6 0 9.5 6 9.5 6a17 17 0 0 1-2.1 2.8M6.2 6.2C3.8 8 2.5 12 2.5 12s3.5 6 9.5 6c1.5 0 2.8-.4 4-1"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>;
}
