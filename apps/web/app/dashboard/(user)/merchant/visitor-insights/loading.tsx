import { PageBody, PageHeader } from '@kit/ui/page';
import { Spinner } from '@kit/ui/spinner';

export default function Loading() {
  return (
    <>
      <PageHeader title="Visitor Insights" description="Loading analytics..." />

      <PageBody>
        <div className="flex items-center justify-center py-24">
          <Spinner className="h-8 w-8" />
        </div>
      </PageBody>
    </>
  );
}
