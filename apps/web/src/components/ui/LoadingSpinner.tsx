import clsx from 'clsx';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function LoadingSpinner({ size = 'md', className }: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'w-4 h-4 border-2',
    md: 'w-6 h-6 border-2',
    lg: 'w-8 h-8 border-[3px]',
  };

  return (
    <span
      className={clsx(
        'inline-block rounded-full border-transparent animate-spin',
        sizeClasses[size],
        className,
      )}
      style={{
        borderTopColor: '#FF4D00',
        borderRightColor: '#FF4D00',
      }}
      aria-label="Loading"
    />
  );
}
