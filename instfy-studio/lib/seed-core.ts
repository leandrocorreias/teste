/**
 * Seed logic, shared by the CLI (`npm run db:seed`) and the guarded bootstrap
 * route used to initialise a hosted database.
 *
 * Every write is an upsert, so running it twice is safe and never duplicates
 * the catalog.
 *
 * EVERY price seeded here is labelled as an EXAMPLE taken from a specific past
 * proposal. It is a starting catalog for the user to edit, not a universal
 * Instfy price list.
 */
import { DISCOVERY_FORM_SLUG, DISCOVERY_FORM_VERSION, FORM_SCHEMA_SNAPSHOT } from './questionnaire';
import { DEFAULT_BRAND_KIT, THEMES } from './design/tokens';
import { LAYOUT_CATALOG } from './design/schema';
import { prisma } from './db';

const R = (reais: number) => reais * 100;

const EXAMPLE_NOTE = 'Valor de exemplo extraído de proposta anterior da Instfy. Revise antes de usar em nova proposta.';

export async function seedDatabase(): Promise<{ services: number; clients: number; layouts: number }> {
  const org = await prisma.organization.upsert({
    where: { id: 'org-instfy' },
    update: {},
    create: {
      id: 'org-instfy',
      name: 'Instfy',
      legalName: 'Instfy Brasil Ltda',
      taxId: '59.268.133/0001-96',
      website: 'instfy.com',
    },
  });

  await prisma.user.upsert({
    where: { email: 'estrategia@instfy.com' },
    update: {},
    create: { orgId: org.id, name: 'Estrategista Instfy', email: 'estrategia@instfy.com', role: 'admin' },
  });

  for (const [key, value] of Object.entries({
    discount_authorization_cap_pct: process.env.DISCOUNT_AUTHORIZATION_CAP_PCT ?? '0',
    default_tax_rate_pct: process.env.DEFAULT_TAX_RATE_PCT ?? '',
    default_term_months: '12',
    instalment_weights: '4000,3000,3000',
  })) {
    await prisma.orgSetting.upsert({
      where: { orgId_key: { orgId: org.id, key } },
      update: {},
      create: { orgId: org.id, key, value },
    });
  }

  /* ----------------------------- brand kits ----------------------------- */
  await prisma.brandKit.upsert({
    where: { id: 'brand-instfy' },
    update: { tokensJson: JSON.stringify(DEFAULT_BRAND_KIT) },
    create: {
      id: 'brand-instfy',
      orgId: org.id,
      name: 'Instfy — padrão',
      isDefault: true,
      tokensJson: JSON.stringify(DEFAULT_BRAND_KIT),
    },
  });

  /* --------------------------- layout templates -------------------------- */
  for (const layout of LAYOUT_CATALOG) {
    await prisma.layoutTemplate.upsert({
      where: { layoutId: layout.layoutId },
      update: { name: layout.name, description: layout.purpose, capacityJson: JSON.stringify({ capacity: layout.capacity }) },
      create: {
        layoutId: layout.layoutId,
        name: layout.name,
        kind: 'presentation',
        description: layout.purpose,
        capacityJson: JSON.stringify({ capacity: layout.capacity }),
      },
    });
  }

  /* ------------------------------ form ----------------------------------- */
  const form = await prisma.form.upsert({
    where: { orgId_slug: { orgId: org.id, slug: DISCOVERY_FORM_SLUG } },
    update: {},
    create: {
      orgId: org.id,
      slug: DISCOVERY_FORM_SLUG,
      name: 'Discovery estratégico Instfy',
      description: 'Questionário setorial de 14 dimensões usado como base de inteligência do projeto.',
    },
  });
  await prisma.formVersion.upsert({
    where: { formId_version: { formId: form.id, version: DISCOVERY_FORM_VERSION } },
    update: { schemaJson: JSON.stringify(FORM_SCHEMA_SNAPSHOT), isPublished: true },
    create: {
      formId: form.id,
      version: DISCOVERY_FORM_VERSION,
      schemaJson: JSON.stringify(FORM_SCHEMA_SNAPSHOT),
      isPublished: true,
    },
  });

  /* --------------------------- service catalog ---------------------------- */
  interface SeedService {
    code: string;
    name: string;
    category: string;
    summary: string;
    billingModel: string;
    scope: string[];
    exclusions: string[];
    rule: {
      kind: string;
      amountCents?: number;
      percentBasisPoints?: number;
      percentOf?: string;
      tiers?: Array<{ fromMonth: number; toMonth: number | null; amountCents: number; label?: string }>;
      label: string;
    };
    notes: string;
  }

  const services: SeedService[] = [
    {
      code: 'PRE-DISCOVERY',
      name: 'Pré-Discovery e diagnóstico estratégico',
      category: 'Estratégia',
      summary: 'Levantamento, análise de mercado e concorrência, oportunidades e direcionamento inicial.',
      billingModel: 'one_time',
      scope: [
        'Diagnóstico do modelo de negócio, marca, produtos, canais e posicionamento',
        'Análise competitiva e referências nacionais e internacionais',
        'Públicos prioritários e oportunidades comerciais',
        'Objetivos, prioridades, indicadores e cronograma',
      ],
      exclusions: ['Pesquisa de campo primária', 'Compra de bases de dados de mercado'],
      rule: { kind: 'one_time', amountCents: R(5000), label: 'Etapa única' },
      notes: `${EXAMPLE_NOTE} Nas propostas Muscle Up e MYO esta etapa foi bonificada.`,
    },
    {
      code: 'PLANEJAMENTO',
      name: 'Planejamento estratégico e calendário anual',
      category: 'Estratégia',
      summary: 'Planejamento do período corrente, objetivos do ano seguinte e calendário anual de marketing.',
      billingModel: 'one_time',
      scope: [
        'Objetivos, metas e indicadores',
        'Calendário anual de marketing, campanhas e sazonalidade',
        'Prioridades por trimestre',
      ],
      exclusions: ['Execução das campanhas planejadas'],
      rule: { kind: 'one_time', amountCents: 0, label: 'Incluso no projeto' },
      notes: `${EXAMPLE_NOTE} Nas duas propostas de referência esta etapa aparece como "incluso no projeto".`,
    },
    {
      code: 'BRANDING',
      name: 'Branding e posicionamento de marca',
      category: 'Marca',
      summary: 'Plataforma de marca, identidade visual, linguagem e manual de identidade.',
      billingModel: 'one_time',
      scope: [
        'Plataforma de marca, proposta de valor, personalidade e tom de voz',
        'Identidade visual, sistema tipográfico, cores e elementos gráficos',
        'Templates digitais, aplicações comerciais e institucionais',
        'Manual de identidade',
        'Até 10 peças-base e seus arquivos finais',
      ],
      exclusions: ['Produção gráfica, impressão e fabricação física', 'Registro de marca no INPI'],
      rule: { kind: 'one_time', amountCents: R(10000), label: 'Etapa única' },
      notes: EXAMPLE_NOTE,
    },
    {
      code: 'WEBSITE-SEO',
      name: 'Website, SEO e presença digital inteligente',
      category: 'Tecnologia',
      summary: 'Website responsivo, SEO técnico e semântico e otimização para respostas por IA.',
      billingModel: 'one_time',
      scope: [
        'Website institucional responsivo, estrutura de até 10 páginas',
        'Formulários de conversão, integração com canais de contato e analytics',
        'SEO técnico e semântico: palavras-chave, metadados, dados estruturados, sitemap, performance',
        'Boas práticas de GEO e AEO para buscadores e sistemas de resposta por IA',
      ],
      exclusions: [
        'Domínio, hospedagem e ferramentas licenciadas',
        'Aplicativo nativo iOS/Android',
        'Software de gestão operacional',
        'Garantia de posicionamento em buscadores ou de menções em respostas de IA',
      ],
      rule: { kind: 'one_time', amountCents: R(12000), label: 'Etapa única' },
      notes: EXAMPLE_NOTE,
    },
    {
      code: 'WEBAPP-MVP',
      name: 'Web app MVP e arquitetura de integração',
      category: 'Tecnologia',
      summary: 'Aplicação web responsiva (PWA) com área do usuário e camada inicial de integração.',
      billingModel: 'one_time',
      scope: [
        'Web app/PWA responsivo com acesso do usuário',
        'Calendário de atividades, histórico e acompanhamento de progressão',
        'Área administrativa básica',
        'Documentação da arquitetura de interoperabilidade e endpoints autorizados',
      ],
      exclusions: [
        'Aplicativo nativo completo',
        'Integrações ilimitadas',
        'Integração com wearables e equipamentos sem API e homologação do fabricante',
      ],
      rule: { kind: 'one_time', amountCents: R(12000), label: 'Etapa única' },
      notes: `${EXAMPLE_NOTE} Na proposta Muscle Up o web app foi orçado em conjunto com o website na etapa de R$ 12.000.`,
    },
    {
      code: 'RECORRENTE',
      name: 'Estratégia e ativações recorrentes',
      category: 'Operação',
      summary: 'Direção estratégica contínua, campanhas, conteúdo e acompanhamento de indicadores.',
      billingModel: 'monthly',
      scope: [
        'Direção estratégica contínua e planejamento mensal de campanhas',
        'Calendário editorial e coordenação de ativações comerciais',
        'Até 12 peças digitais estáticas ou adaptadas por ciclo mensal',
        'Até 4 vídeos curtos editados a partir de material disponibilizado',
        'Reunião mensal de performance e acompanhamento de indicadores',
      ],
      exclusions: [
        'Influenciadores e produção audiovisual presencial',
        'Eventos, brindes e fornecedores externos',
        'Verba de mídia paga',
      ],
      rule: { kind: 'monthly', amountCents: R(8000), label: 'Por mês' },
      notes: EXAMPLE_NOTE,
    },
    {
      code: 'RECORRENTE-LANCAMENTO',
      name: 'Estratégia recorrente com condição de lançamento',
      category: 'Operação',
      summary: 'Mesmo escopo recorrente, com mensalidade reduzida nos primeiros meses de operação.',
      billingModel: 'tiered_monthly',
      scope: [
        'Escopo idêntico ao da operação recorrente, sem redução de entregas',
        'Mensalidade reduzida durante a fase inicial de operação',
      ],
      exclusions: ['Mídia paga', 'Eventos e produção de terceiros'],
      rule: {
        kind: 'tiered_monthly',
        tiers: [
          { fromMonth: 1, toMonth: 6, amountCents: R(5000), label: 'Condição de lançamento' },
          { fromMonth: 7, toMonth: null, amountCents: R(8000), label: 'Mensalidade contratual' },
        ],
        label: 'Escalonado por mês',
      },
      notes: `${EXAMPLE_NOTE} Reproduz a condição da proposta MYO: R$ 5.000 nos meses 1 a 6 e R$ 8.000 do mês 7 em diante.`,
    },
    {
      code: 'COMUNICACAO',
      name: 'Comunicação digital e gestão de conteúdo',
      category: 'Comunicação',
      summary: 'Estruturação e operação contínua de redes sociais, com captação presencial.',
      billingModel: 'tiered_monthly',
      scope: [
        'Mês 1: 20 publicações no feed (16 estáticas/carrosséis e 4 vídeos curtos)',
        'A partir do mês 2: 12 publicações no feed/mês (8 estáticas/carrosséis e 4 vídeos curtos)',
        '12 sequências de stories por mês, com até 3 telas cada',
        '2 dias de captação presencial por mês, em datas acordadas',
        '1 relatório e 1 reunião mensal',
        'Até 2 campanhas simultâneas e 4 variações de anúncios por mês',
      ],
      exclusions: [
        'Atendimento de mensagens e comentários',
        'Site e identidade visual completa',
        'Verba de anúncios, paga à parte pelo cliente',
      ],
      rule: {
        kind: 'tiered_monthly',
        tiers: [
          { fromMonth: 1, toMonth: 3, amountCents: R(3500), label: 'Condição de entrada' },
          { fromMonth: 4, toMonth: null, amountCents: R(4000), label: 'Valor mensal regular' },
        ],
        label: 'Escalonado por mês',
      },
      notes: `${EXAMPLE_NOTE} Reproduz a proposta de comunicação: R$ 3.500/mês nos meses 1 a 3 e R$ 4.000/mês a partir do mês 4. A condição de verba mínima e o gatilho de 20% acima de R$ 10.000/mês de tráfego constam no texto original e devem ser revisados e aprovados caso a caso — não são regra geral.`,
    },
    {
      code: 'GESTAO-MIDIA',
      name: 'Gestão de campanhas de mídia paga',
      category: 'Mídia',
      summary: 'Planejamento, configuração, otimização e análise de campanhas, cobrado como percentual da verba.',
      billingModel: 'percent_of_base',
      scope: [
        'Planejamento, configuração e segmentação das campanhas',
        'Monitoramento, testes e otimização nas plataformas acordadas',
        'Análise de performance e prestação de contas',
      ],
      exclusions: [
        'A verba de anúncios em si, paga diretamente às plataformas pelo cliente',
        'Garantia de volume de leads ou de faturamento',
      ],
      rule: { kind: 'percent_of_base', percentBasisPoints: 2000, percentOf: 'media_budget', label: '% da verba de mídia' },
      notes: `${EXAMPLE_NOTE} Nas propostas de referência o percentual praticado foi de 20% da verba efetivamente aplicada no período.`,
    },
    {
      code: 'VERBA-MIDIA',
      name: 'Verba de anúncios (repasse a plataformas)',
      category: 'Mídia',
      summary: 'Investimento em anúncios definido e aprovado pelo cliente, pago diretamente às plataformas.',
      billingModel: 'third_party_spend',
      scope: [
        'Valor definido e aprovado previamente pelo cliente',
        'Pago diretamente às plataformas, preferencialmente em contas de titularidade do cliente',
      ],
      exclusions: ['Não é honorário Instfy e não compõe a receita da agência'],
      rule: { kind: 'third_party_spend', amountCents: 0, label: 'Definido pelo cliente' },
      notes: 'Sem valor padrão: a verba é sempre informada pelo cliente na configuração da proposta.',
    },
  ];

  for (const s of services) {
    const service = await prisma.service.upsert({
      where: { orgId_code: { orgId: org.id, code: s.code } },
      update: { name: s.name, category: s.category, summary: s.summary },
      create: { orgId: org.id, code: s.code, name: s.name, category: s.category, summary: s.summary },
    });
    const version = await prisma.serviceVersion.upsert({
      where: { serviceId_version: { serviceId: service.id, version: 1 } },
      update: {
        billingModel: s.billingModel,
        scopeJson: JSON.stringify(s.scope),
        exclusionsJson: JSON.stringify(s.exclusions),
        notes: s.notes,
      },
      create: {
        serviceId: service.id,
        version: 1,
        billingModel: s.billingModel,
        scopeJson: JSON.stringify(s.scope),
        exclusionsJson: JSON.stringify(s.exclusions),
        notes: s.notes,
        isCurrent: true,
      },
    });
    const existingRule = await prisma.pricingRule.findFirst({ where: { serviceVersionId: version.id } });
    if (!existingRule) {
      await prisma.pricingRule.create({
        data: {
          serviceVersionId: version.id,
          kind: s.rule.kind,
          amountCents: s.rule.amountCents ?? null,
          percentBasisPoints: s.rule.percentBasisPoints ?? null,
          percentOf: s.rule.percentOf ?? null,
          tiersJson: JSON.stringify(s.rule.tiers ?? []),
          label: s.rule.label,
        },
      });
    }
  }

  /* ------------------------------ demo clients ---------------------------- */
  const demoClients = [
    {
      id: 'client-muscleup',
      name: 'Muscle Up (exemplo)',
      sector: 'fitness_wellness',
      city: 'São Paulo',
      state: 'SP',
      notes: 'Cliente de demonstração baseado na proposta de referência. Dados comerciais são exemplos, não dados reais do cliente.',
      contacts: [{ name: 'Bruna', role: 'CEO', isPrimary: true }],
      project: { id: 'project-muscleup', name: 'Estratégia, marca, tecnologia e crescimento' },
    },
    {
      id: 'client-myo',
      name: 'Myo Training & Wellness (exemplo)',
      sector: 'fitness_wellness',
      city: 'São Paulo',
      state: 'SP',
      notes: 'Cliente de demonstração baseado na proposta de referência. Dados comerciais são exemplos, não dados reais do cliente.',
      contacts: [
        { name: 'Thiago', role: 'Sócio', isPrimary: true },
        { name: 'Helena', role: 'Sócia', isPrimary: false },
      ],
      project: { id: 'project-myo', name: 'Posicionamento, experiência e crescimento' },
    },
  ];

  for (const c of demoClients) {
    const client = await prisma.client.upsert({
      where: { id: c.id },
      update: {},
      create: {
        id: c.id,
        orgId: org.id,
        name: c.name,
        sector: c.sector,
        city: c.city,
        state: c.state,
        notes: c.notes,
      },
    });
    for (const contact of c.contacts) {
      const exists = await prisma.contact.findFirst({ where: { clientId: client.id, name: contact.name } });
      if (!exists) {
        await prisma.contact.create({ data: { clientId: client.id, ...contact } });
      }
    }
    await prisma.project.upsert({
      where: { id: c.project.id },
      update: {},
      create: {
        id: c.project.id,
        orgId: org.id,
        clientId: client.id,
        name: c.project.name,
        sector: c.sector,
        status: 'discovery',
        summary: 'Projeto de demonstração. Nenhum dado financeiro ou de mercado real foi importado.',
      },
    });
  }

  await prisma.auditLog.create({
    data: { orgId: org.id, actor: 'seed', action: 'seed', entity: 'Organization', entityId: org.id, metaJson: JSON.stringify({ services: services.length, themes: Object.keys(THEMES).length }) },
  });

  return { services: services.length, clients: demoClients.length, layouts: LAYOUT_CATALOG.length };
}
