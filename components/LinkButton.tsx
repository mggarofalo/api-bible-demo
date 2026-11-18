import { SquareArrowOutUpRight } from "lucide-react";
import Link from "next/link";
import { ReactNode } from "react";

export type LinkButtonProps = {
  title: string;
  href: string;
  external?: boolean;
  children?: ReactNode;
  className?: string;
};

/**
 * Renders a link as a button
 */
export const LinkButton = ({
  title,
  href,
  external,
  children,
  className,
}: LinkButtonProps) => {
  return (
    <Link
      href={href}
      prefetch={false}
      className={`flex gap-2 items-center justify-center px-4 py-2 rounded bg-accent-soft hover:bg-accent hover:text-white border-accent ${className ?? ""}`}
    >
      {children}
      {!!title && <span className="text-md text-nowrap">{title}</span>}
      {external && <SquareArrowOutUpRight size={12} />}
    </Link>
  );
};
