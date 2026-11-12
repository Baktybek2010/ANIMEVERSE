const MEDIA_FIELDS = /* GraphQL */ `
  id
  idMal
  title { romaji english native }
  synonyms
  description(asHtml: false)
  format
  status
  season
  seasonYear
  startDate { year month day }
  endDate { year month day }
  episodes
  duration
  averageScore
  meanScore
  popularity
  trending
  genres
  isAdult
  countryOfOrigin
  source
  coverImage { extraLarge large color }
  bannerImage
  trailer { id site }
  studios(isMain: true) { nodes { name } }
`;

export const PAGE_QUERY = /* GraphQL */ `
  query AnimePage(
    $page: Int!
    $perPage: Int!
    $search: String
    $ids: [Int]
    $sort: [MediaSort]
    $season: MediaSeason
    $seasonYear: Int
    $status: MediaStatus
    $isAdult: Boolean
  ) {
    Page(page: $page, perPage: $perPage) {
      pageInfo { total currentPage lastPage hasNextPage perPage }
      media(
        type: ANIME
        search: $search
        id_in: $ids
        sort: $sort
        season: $season
        seasonYear: $seasonYear
        status: $status
        isAdult: $isAdult
      ) {
        ${MEDIA_FIELDS}
      }
    }
  }
`;
