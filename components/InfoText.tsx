import Link from "next/link";
import { ReactNode } from "react";

/**
 * Small parts used to write the text of an `InfoSection`
 */

/** Link to a guide or other reference page */
export const Guide = ({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) => (
  <Link href={href} className="underline">
    {children}
  </Link>
);

/** Literal text, such as an endpoint, a parameter or a field name */
export const Code = ({ children }: { children: ReactNode }) => (
  <code className="font-bold">{children}</code>
);

/** First paragraph of an `InfoSection` */
export const Lead = ({ children }: { children: ReactNode }) => (
  <p className="mb-2">{children}</p>
);

/** Secondary paragraph of an `InfoSection` */
export const Note = ({ children }: { children: ReactNode }) => (
  <p className="text-sm">Note: {children}</p>
);
