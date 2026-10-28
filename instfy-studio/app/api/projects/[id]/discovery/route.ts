import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma, getOrg, audit } from '@/lib/db';
import { DISCOVERY_FORM_SLUG, DISCOVERY_FORM_VERSION, computeCompletion } from '@/lib/questionnaire';

const payload = z.object({
  answers: z.record(z.string(), z.union([z.string(), z.number(), z.array(z.string()), z.null()])),
  submit: z.boolean().default(false),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const org = await getOrg();
  const { id } = await params;
  const parsed = payload.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Respostas inválidas' }, { status: 400 });
  }

  const project = await prisma.project.findFirst({ where: { id, orgId: org.id, deletedAt: null } });
  if (!project) return NextResponse.json({ error: 'Projeto não encontrado' }, { status: 404 });

  const form = await prisma.form.findUnique({ where: { orgId_slug: { orgId: org.id, slug: DISCOVERY_FORM_SLUG } } });
  if (!form) return NextResponse.json({ error: 'Formulário de discovery não encontrado. Rode o seed.' }, { status: 500 });
  const formVersion = await prisma.formVersion.findUnique({
    where: { formId_version: { formId: form.id, version: DISCOVERY_FORM_VERSION } },
  });
  if (!formVersion) return NextResponse.json({ error: 'Versão do formulário não encontrada' }, { status: 500 });

  const submission =
    (await prisma.submission.findFirst({
      where: { projectId: project.id, formVersionId: formVersion.id },
      orderBy: { createdAt: 'desc' },
    })) ??
    (await prisma.submission.create({ data: { projectId: project.id, formVersionId: formVersion.id, status: 'draft' } }));

  // Upsert each answer so partial saves never lose prior content.
  for (const [questionId, value] of Object.entries(parsed.data.answers)) {
    await prisma.answer.upsert({
      where: { submissionId_questionId: { submissionId: submission.id, questionId } },
      update: { valueJson: JSON.stringify(value) },
      create: { submissionId: submission.id, questionId, valueJson: JSON.stringify(value) },
    });
  }

  const completion = computeCompletion(project.sector, parsed.data.answers);

  if (parsed.data.submit) {
    await prisma.submission.update({
      where: { id: submission.id },
      data: { status: 'submitted', submittedAt: new Date() },
    });
    await prisma.project.update({ where: { id: project.id }, data: { status: 'analysis' } });
  }

  await audit(org.id, parsed.data.submit ? 'submit' : 'save', 'Submission', submission.id, {
    answered: completion.answered,
    missingCritical: completion.missingCritical.length,
  });

  return NextResponse.json({ submissionId: submission.id, completion });
}
