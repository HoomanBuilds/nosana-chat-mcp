'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';

export default function NotFound() {
  const router = useRouter();

  // useEffect(() => {
  //   router.replace('/ask');
  // }, [router]);

  return (
    <div className='text-white flex flex-col items-center justify-center w-full h-screen'>
      <Image src="/nosana.png" alt='nosana' className='mb-10 grayscale-100 opacity-10' width={80} height={80} />
      <h1 className='sm:text-4xl mb-5 text-white/10'>
        <span className='text-8xl'>404</span> - Page Does not exist
      </h1>
      <Link href="/ask" className='text-yellow-500'>Ask/</Link>
    </div>
  );
}
