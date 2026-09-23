import React from "react";
import Link from "next/link";
import { Button } from "./Button";

interface EmptyStateProps {
  title: string;
  subtitle: string;
  primaryActionText?: string;
  primaryActionHref?: string;
  secondaryActionText?: string;
  secondaryActionHref?: string;
  onPrimaryClick?: () => void;
  icon?: React.ReactNode;
}

export function EmptyState({
  title,
  subtitle,
  primaryActionText,
  primaryActionHref,
  secondaryActionText,
  secondaryActionHref,
  onPrimaryClick,
  icon,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center text-center px-6 py-16 max-w-sm mx-auto">
      {icon && (
        <div className="w-16 h-16 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-400 mb-5">
          {icon}
        </div>
      )}
      <h3 className="text-xl font-bold tracking-tight text-neutral-900 mb-2">{title}</h3>
      <p className="text-sm text-neutral-500 italic mb-7 leading-relaxed">{subtitle}</p>

      <div className="flex flex-col gap-2.5 w-full">
        {primaryActionText && (
          primaryActionHref ? (
            <Link href={primaryActionHref} className="w-full">
              <Button variant="primary" className="w-full">
                {primaryActionText}
              </Button>
            </Link>
          ) : (
            <Button variant="primary" onClick={onPrimaryClick} className="w-full">
              {primaryActionText}
            </Button>
          )
        )}

        {secondaryActionText && secondaryActionHref && (
          <Link href={secondaryActionHref} className="w-full">
            <Button variant="secondary" className="w-full">
              {secondaryActionText}
            </Button>
          </Link>
        )}
      </div>
    </div>
  );
}
