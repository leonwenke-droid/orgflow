'use client';

import { createContext, useContext, type ReactNode } from "react";
import type { Organization } from "./getOrganization";

const OrganizationContext = createContext<Organization | null>(null);

export function OrganizationProvider({
  organization,
  children
}: {
  organization: Organization;
  children: ReactNode;
}) {
  return (
    <OrganizationContext.Provider value={organization}>
      {children}
    </OrganizationContext.Provider>
  );
}

export function useOrganization() {
  const org = useContext(OrganizationContext);
  if (!org) {
    throw new Error("useOrganization must be used within OrganizationProvider");
  }
  return org;
}

