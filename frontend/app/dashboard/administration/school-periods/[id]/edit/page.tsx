import { SchoolPeriodForm } from '../../school-period-form';

export default async function EditSchoolPeriodPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <SchoolPeriodForm periodId={id} />;
}
