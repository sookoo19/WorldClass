export default function PartnerDashboard({ status }: { status: string }) {
    return (
        <div className='flex min-h-screen flex-col items-center justify-center gap-4'>
            {status === 'pending' && (
                <p className='rounded bg-yellow-100 px-4 py-2 text-yellow-800'>
                    現在審査中です。承認されるとセッションを提供できるようになります。
                </p>
            )}
            <h1 className='text-2xl font-bold'>パートナーダッシュボード</h1>
        </div>
    );
}
