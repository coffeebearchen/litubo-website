import type { Post } from '~/types/content'

export function usePostDetail(slug: string) {
  const { locale } = useI18n()

  const { data: post, error } = useAsyncData<Post>(
    `post-${slug}`,
    () => $fetch<Post>(`/api/cms/posts/${slug}`),
  )

  function localized(field: { en: string; es: string; pt: string } | undefined): string {
    if (!field) return ''
    return field[locale.value as 'en' | 'es' | 'pt'] || field.en
  }

  return { post, error, localized }
}
