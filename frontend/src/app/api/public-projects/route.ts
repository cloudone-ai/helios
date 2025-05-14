import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const supabase = await createClient();
    
    // 获取 projects 表中 is_public 为 true 的最新 12 条记录，并与 threads 表进行 left join
    const { data, error } = await supabase
      .from('projects')
      .select(`
        project_id,
        name,
        description,
        category,
        imgurl,
        icon,
        created_at,
        threads (
          thread_id
        )
      `)
      .eq('is_public', true)
      .order('created_at', { ascending: false })
      .limit(12);

    if (error) {
      console.error('Error fetching public projects:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // 转换数据格式以匹配前端需要的格式
    const formattedData = data.map(project => {
      // 获取第一个关联的 thread_id（如果存在）
      const threadId = project.threads && project.threads.length > 0 
        ? project.threads[0].thread_id 
        : null;

      return {
        id: project.project_id,
        title: project.name || '',
        description: project.description || '',
        category: project.category || 'general',
        featured: true,
        icon: project.icon || null,
        image: project.imgurl || `https://placehold.co/800x400/f5f5f5/666666?text=Suna+${project.name?.split(' ').join('+')}`,
        url: threadId ? `/share/${threadId}` : '#',
      };
    });

    return NextResponse.json(formattedData);
  } catch (error) {
    console.error('Unexpected error fetching public projects:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
