import type { Post } from '~/types/content'

/**
 * Loads one legacy post for its public detail page. It is awaited, so the page knows the API's 404 or
 * 503 before it renders (FINAL-RELEASE-FIX-C). `localized` reads the current locale only; another
 * locale's text is never shown instead (RSG-05).
 */
export async function usePostDetail(slug: string) {
  const { locale } = useI18n()

  const { data: post, error } = await useAsyncData<Post>(
    `post-${slug}`,
    () => $fetch<Post>(`/api/cms/posts/${slug}`),
  )

  function localized(field: { en: string; es: string; pt: string } | undefined): string {
    if (!field) return ''
    return field[locale.value as 'en' | 'es' | 'pt'] ?? ''
  }

  return { post, error, localized }
}
