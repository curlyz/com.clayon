export interface BuildCiliumNetworkPolicyInput {
  namespace: string;
  clayonServerNamespace: string;
  egressAllowFqdns: string[];
  egressAllowCidrs: string[];
  name?: string;
  endpointSelector?: Record<string, string>;
  includeBaseRules?: boolean;
  ownerReferences?: Record<string, unknown>[];
}

// Design note: no ingress rules are defined here. Clayon-server does NOT
// push to agent pods — agents make outbound (egress) callbacks to
// clayon-server on port 3100. If server→agent push is ever needed, add a
// targeted ingress rule scoped to the clayon-server endpoint selector.
export function buildCiliumNetworkPolicyManifest(input: BuildCiliumNetworkPolicyInput): Record<string, unknown> {
  const egress: Record<string, unknown>[] = [];

  if (input.includeBaseRules !== false) egress.push({
    toEndpoints: [
      { matchLabels: { "k8s:io.kubernetes.pod.namespace": "kube-system", "k8s-app": "kube-dns" } },
    ],
    toPorts: [
      {
        ports: [
          { port: "53", protocol: "UDP" },
          { port: "53", protocol: "TCP" },
        ],
        rules: { dns: [{ matchPattern: "*" }] },
      },
    ],
  });

  if (input.egressAllowFqdns.length > 0) {
    egress.push({
      toFQDNs: input.egressAllowFqdns.map((fqdn) => ({ matchName: fqdn })),
      toPorts: [{ ports: [{ port: "443", protocol: "TCP" }] }],
    });
  }

  if (input.includeBaseRules !== false) egress.push({
    toEndpoints: [
      {
        matchLabels: {
          "k8s:io.kubernetes.pod.namespace": input.clayonServerNamespace,
          app: "clayon-server",
        },
      },
    ],
    toPorts: [{ ports: [{ port: "3100", protocol: "TCP" }] }],
  });

  if (input.egressAllowCidrs.length > 0) {
    egress.push({
      toCIDRSet: input.egressAllowCidrs.map((cidr) => ({ cidr })),
    });
  }

  return {
    apiVersion: "cilium.io/v2",
    kind: "CiliumNetworkPolicy",
    metadata: {
      name: input.name ?? "clayon-egress-fqdn",
      namespace: input.namespace,
      labels: { "clayon.io/managed-by": "clayon-k8s-plugin" },
      ...(input.ownerReferences ? { ownerReferences: input.ownerReferences } : {}),
    },
    spec: {
      endpointSelector: { matchLabels: input.endpointSelector ?? { "clayon.io/role": "agent" } },
      egress,
    },
  };
}
