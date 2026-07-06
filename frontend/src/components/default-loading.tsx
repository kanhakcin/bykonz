import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';

const DefaultLoading = () => {
  return (
    <Skeleton className="flex h-48 w-full items-center justify-center">
      <Spinner />
    </Skeleton>
  );
};

export default DefaultLoading;
