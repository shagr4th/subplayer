import { createSelector } from 'reselect'

const getAlbum = (state, props) => state.albums.byId[props.albumId]

const getSongs = (state, props) => state.songs.byId

export const makeGetSongsOfAlbum = () => {
    return createSelector (
        [ getAlbum, getSongs ],
        (album, songs) => {
            return album ? Object.keys(songs).map(id => songs[id]).filter(song => song.albumId === album.id) : []
        }
    )
}

export const songsSelector = createSelector(
    [getSongs],
    songs => Object.keys(songs).map(id => songs[id])
)

export const songsOfArtistSelector = createSelector(
    [getSongs, (state, props) => props.artistId ],
    (songs, artistId) => {
        return Object.keys(songs).map(id => songs[id]).filter(song => song.artistId === artistId)
    }
)
