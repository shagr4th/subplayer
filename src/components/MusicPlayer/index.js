// Redux
import { connect } from "react-redux"
import { playNextSong, playPreviousSong, seekToSongInQueue, toggleShuffle } from "../../redux/actions/songsActions"
import { setStarOnSongs } from "../../redux/actions/favouritesActions"
import { getSongsInQueueSelector, getSongCurrentlyPlayingSelector } from '../../redux/selectors/musicPlayerSelector'
// UI
import MusicPlayer from './MusicPlayer'

const mapStateToProps = (state) => {
    return {
        "song" : getSongCurrentlyPlayingSelector(state),
        "songs" : getSongsInQueueSelector(state),
        "isShuffleOn": state.musicPlayer.isShuffleOn,
    }
}

const mapDispatchToProps = { playNextSong, playPreviousSong, seekToSongInQueue, setStarOnSongs, toggleShuffle }

export default connect(
    mapStateToProps,
    mapDispatchToProps
)(MusicPlayer)