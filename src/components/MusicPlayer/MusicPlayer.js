import React from 'react'
import PropTypes from 'prop-types'
import { navigate } from "@reach/router"
// Utils
import { Howl } from 'howler'
import subsonic from "../../api/subsonicApi"
import { seconds_to_mss } from "../../utils/formatting.js"
import * as settings from "../../utils/settings.js"
// UI
import { IconButton, Icon } from 'rsuite'
import Slider from 'rc-slider';
import 'rc-slider/assets/index.css';
import "./MusicPlayer.less"
/* eslint-disable */

export default class MusicPlayer extends React.Component {
    
    constructor(props) {
        super(props)
        this.state = { playing:false, tick: 0, isMuted: false, volume: settings.getVolume(),isCastConnected:false, castPlayerState:null, nextSongFromCastQueue: null, song:null, castQueueSongs:[] }
        this.volumeBeforeMutting = 1.0
        this.isSeeking = false
        this.castPlayer = null;
        this.castPlayerController = null;
    }

    componentDidMount() {
        window['__onGCastApiAvailable'] = (isAvailable) => {
            if (isAvailable && cast) {
                this.initializeCastPlayer();
            } else {
                console.log("Was not able to initialize CastPlayer")
            }
        }
        const script = document.createElement("script");
        script.src = "https://www.gstatic.com/cv/js/sender/v1/cast_sender.js?loadCastFramework=1";
        script.async = true;
        document.body.appendChild(script);
    }

    initializeCastPlayer = () => {
        var options = {};

        options.receiverApplicationId = 'CC1AD845';
        options.autoJoinPolicy = chrome.cast.AutoJoinPolicy.ORIGIN_SCOPED;
        options.androidReceiverCompatible = true;
        cast.framework.CastContext.getInstance().setOptions(options);

        this.castPlayer = new cast.framework.RemotePlayer();
        this.castPlayerController = new cast.framework.RemotePlayerController(this.castPlayer);

        this.castPlayerController.addEventListener(
            cast.framework.RemotePlayerEventType.IS_CONNECTED_CHANGED,
            function (e) {
                var isCastConnected = e.value
                this.setState({ isCastConnected }, () => {
                    console.log("Chromecast connection: ", isCastConnected)
                })
            }.bind(this)
        );

        this.castPlayerController.addEventListener(
            cast.framework.RemotePlayerEventType.PLAYER_STATE_CHANGED,
            function (e) {
                console.log("Chromecast is " + e.value)
                this.setState({ castPlayerState: e.value })
                if (e.value === "PAUSED" && this.state.playing) {
                    this.setState({ playing: false });
                } else if (e.value === "PLAYING" && !this.state.playing) {
                    if (!this.state.song && this.castPlayer && this.castPlayer.mediaInfo) {
                        this.setState({
                            playing: true,
                            song: {
                                id: this.castPlayer.mediaInfo.contentId,
                                title: this.castPlayer.mediaInfo.metadata.title,
                                duration: Math.ceil(this.castPlayer.mediaInfo.duration)
                            }
                        })
                        this.streamer = this.cast();
                    }
                }
            }.bind(this)
        );

        this.castPlayerController.addEventListener(
            cast.framework.RemotePlayerEventType.CURRENT_TIME_CHANGED,
            function () {
                if (this.castPlayer) {
                    this.setState({
                        tick: Math.ceil(this.castPlayer.currentTime)
                    })
                }
            }.bind(this)
        );

        this.castPlayerController.addEventListener(
            cast.framework.RemotePlayerEventType.QUEUE_DATA_CHANGED,
            function () {
                if (this.castPlayer && this.castPlayer.mediaInfo && this.state.castQueueSongs) {
                    let nextSongFromCastQueue = this.state.castQueueSongs.find(song => this.castPlayer.mediaInfo.contentId == song.id);
                    console.log("nextSongFromCastQueue " + nextSongFromCastQueue);
                    this.setState({
                        nextSongFromCastQueue: nextSongFromCastQueue
                    })
                    if (nextSongFromCastQueue) {
                        this.props.seekToSongInQueue(nextSongFromCastQueue);
                    }
                }
            }.bind(this)
        );
    }

    cast = (songs, prevSongs) => {
        let reloadQueue = songs && songs != prevSongs && songs.some(song => !prevSongs.some(prevSong => prevSong.id == song.id));
        if (reloadQueue || (songs && !this.state.nextSongFromCastQueue)) {
            let request = new chrome.cast.media.QueueLoadRequest(songs.map(song => {
                let mediaInfo = new chrome.cast.media.MediaInfo(song.id, 'audio/mp3')
                mediaInfo.contentUrl = subsonic.getStreamUrl(song.id);

                mediaInfo.streamType = chrome.cast.media.StreamType.BUFFERED;
                mediaInfo.duration = song.duration;
                mediaInfo.metadata = new chrome.cast.media.MusicTrackMediaMetadata();
                mediaInfo.metadata.title = song.title;
                mediaInfo.metadata.artist = song.artist;
                mediaInfo.metadata.albumName = song.album;
                if (song.coverArt) {
                    mediaInfo.metadata.images = [ new chrome.cast.Image(subsonic.getCoverArtUrl(song.coverArt)) ];
                }
                return new chrome.cast.media.QueueItem(mediaInfo);
            }));

            var session = cast.framework.CastContext.getInstance().getCurrentSession()
            if (session) {
                session.getSessionObj().queueLoad(request, () => {
                    console.log("Queue cast is loaded")
                }, (e) => {
                    console.log(e)
                })
            } else {
                console.log("No cast session is available");
            }
        }
        this.setState({
            nextSongFromCastQueue: null,
            castQueueSongs: songs && songs.length > 0 ? songs.slice(1) : []
        })
        return {
            play: () => {
                var session = cast.framework.CastContext.getInstance().getCurrentSession()
                if (session && this.state.castPlayerState != 'PLAYING') {
                    console.log("CAST PLAY");
                    this.castPlayerController.playOrPause();
                }
            },
            pause: () => {
                var session = cast.framework.CastContext.getInstance().getCurrentSession()
                if (session && this.state.castPlayerState == 'PLAYING') {
                    console.log("CAST PAUSE");
                    this.castPlayerController.playOrPause();
                }
            },
            stop: () => {
                var session = cast.framework.CastContext.getInstance().getCurrentSession()
                if (session && !this.state.castQueueSongs) {
                    console.log("CAST STOP");
                    this.castPlayer.currentTime = 0;
                    this.castPlayerController.seek();
                    this.castPlayerController.stop();
                }
            },
            seek: (seekTime) => {
                var session = cast.framework.CastContext.getInstance().getCurrentSession()
                if (session) {
                    if (seekTime == undefined) {
                        return this.castPlayer.currentTime;
                    }
                    this.castPlayer.currentTime = seekTime;
                    this.castPlayerController.seek();
                }
            },
            unload: () => {
                
            },
            volume: (newVolume) => {
                var session = cast.framework.CastContext.getInstance().getCurrentSession()
                if (session) {
                    this.castPlayer.volumeLevel = newVolume;
                    this.castPlayerController.setVolumeLevel();
                }
            }
        }
    }

    componentDidUpdate(prevProps) {
        // Check if there is a song to play
        if( this.props.song ) {
            var playNextSong = this.props.playNextSong
            var previousSong = prevProps.song ? prevProps.song : {}
            if( this.props.song.id !== previousSong.id) {
                const shouldScrobble = settings.getIsScrobbling()
                // Stop the current song if playing
                this.clearMusicPlayer()
                // Mark the previous song as submitted if it was played enough to scrobble
                if( shouldScrobble && this.isTickingEnoughToScrobble(previousSong, this.state.tick) ) {
                    subsonic.scrobble(previousSong.id, Date.now(), true)
                }
                // Stop the previous song to prevent both songs to play at the same time
                const newSong = this.props.song
                if (this.state.isCastConnected) {
                    this.streamer = this.cast(this.props.songs, prevProps.songs);
                } else {
                    this.streamer = new Howl({
                        src: [subsonic.getStreamUrl(newSong.id)],
                        ext: ['mp3'],
                        preload: false,
                        pool: 2,
                        autoplay: true,
                        html5: true,
                        volume: this.state.volume,
                        // Play next song
                        onend: function() {
                            playNextSong()
                        }
                    })
                }
                this.streamer.play()
                this.startSongTicker()
                this.isSeeking = false
                this.setState({playing : true, tick: 0})
                // Update title
                document.title = `${newSong.title} - ${newSong.artist}`
                // Scrobble
                shouldScrobble && subsonic.scrobble(newSong.id, Date.now(), false)
            }
        }
        // If there is no song to play, stop whatever was playing
        else {
            this.clearMusicPlayer()
            // Update title
            document.title = "SubPlayer"
        }
    }

    startSongTicker() {
        clearInterval(this.timerID)
        this.timerID = setInterval(() => {
            if( this.state.playing ) {
                this.tick()
            }
        }, 1000)
    }

    tick() {
        if( !this.isSeeking ) {
            this.setState({
                tick: Math.ceil(this.streamer.seek())
            })
        }
    }

    isTickingEnoughToScrobble(song, tick) {
        /* https://www.last.fm/api/scrobbling#when-is-a-scrobble-a-scrobble
         * Send scrobble if:
         * 1. if the song is longer than 30 seconds AND
         * 2. the song was played for at least 50% of its length OR
         * 3. the song was played for at least 4 minutes
         */
        const duration = song.duration
        return duration > 30 && (tick >= .5*duration || tick >= 4*60 )
    }

    onSeeking = (value) => {
        if( this.streamer ) {
            this.isSeeking = true
            this.setState({tick: value})
        }
    }

    onSeekingStopped = (value) => {
        if( this.isSeeking ) {
            this.isSeeking = false
            this.streamer.seek(value)
            this.setState({tick: value})
        }
    }

    componentWillUnmount() {
        clearInterval(this.timerID)
        // Stop the current song if playing
        this.clearMusicPlayer()
    }

    changeVolume = (newVolume) => {
        this.streamer && this.streamer.volume(newVolume)
        this.setState({volume: newVolume})
        this.volumeBeforeMutting = newVolume
        // update settings
        settings.setVolume(newVolume)
    }

    toggleMute = () => {
        const isMuted = this.state.isMuted
        if( isMuted ) {
            this.streamer && this.streamer.volume(this.volumeBeforeMutting)
            this.setState({ volume : this.volumeBeforeMutting, isMuted: false })
        }
        else {
            this.streamer && this.streamer.volume(0.0)
            this.setState({ volume : 0.0, isMuted: true })
        }
    }

    togglePlayerState = () => {
        if( this.streamer ) {
            if(this.state.playing) {
                this.streamer.pause()
            }
            else {
                this.streamer.play()
            }
            this.setState({ playing : !this.state.playing })
        }
    }

    toggleStarOnSong = () => {
        if( this.props.song && this.props.setStarOnSongs ){
            this.props.setStarOnSongs([this.props.song], !this.props.song.starred)
        }
    }

    toggleShuffle = () => {
        this.props.toggleShuffle(!this.props.isShuffleOn)
    }

    goToQueueView = () => {
        navigate("/queue/")
    }

    goToArtist = (artistId) => {
        navigate(`/artists/${artistId}`)
    }

    goToAlbum = (albumId) => {
        if( albumId ) {
            navigate(`/album/${albumId}`)
        }
    }

    playNextSong = () => {
        this.props.playNextSong && this.props.playNextSong()
    }

    playPreviousSong = () => {
        // if the song has just started (according to a defined threshold), play
        // the previous song. If not, go back to the beginning of this song
        if( this.state.playing ) {
            const currentSeconds = this.streamer ? this.streamer.seek() : 0
            if( currentSeconds <= 3 ) {
                this.props.playPreviousSong && this.props.playPreviousSong()
            }
            else {
                this.streamer.seek(0)
                this.tick()
            }
        }
    }

    clearMusicPlayer = () => {
        if( this.streamer ) {
            this.streamer.stop()
            this.streamer.unload()
        }
        clearInterval(this.timerID)
        // "Reset" UI
        this.state.playing && !this.state.song && this.setState({playing : false, tick: 0})
    }

    render () {
        const song = this.props.song ? this.props.song : (this.state.song ? this.state.song : {})
        const playing = this.state.playing
        const seek = this.state.tick
        const starIcon = song.starred ? "star" : "star-o"
        const volume = this.state.volume
        const isShuffleOn = this.props.isShuffleOn
        return (
            <div className="music-player">
                {/* Currently playing information */}
                <div className="song_metadata_container">
                    <img id="song_album" src={song.coverArt ? subsonic.getCoverArtUrl(song.coverArt) : "/currently_placeholder.png"} alt="cover" width="45" height="45" onClick={e => this.goToAlbum(song.albumId)}/>
                    <div style={{overflow:"hidden"}}>
                        <p id="song_name"><b>{song.title}</b></p>
                        <span id="song_artist" className="artist-link" onClick={e => this.goToArtist(song.artistId)}>{song.artist}</span>
                    </div>
                    <IconButton id="star_button" icon={<Icon icon={starIcon} />} onClick={this.toggleStarOnSong} appearance="link" size="lg"/>
                </div>
                {/* Music player controls */}
                <div className="currently_playing_controls">
                    <IconButton id="previous_button" icon={<Icon icon="step-backward" />} appearance="link" size="sm" onClick={this.playPreviousSong}/>
                    <IconButton id="play_pause_button" appearance="primary" icon={<Icon icon={playing ? "pause" : "play"} />} circle size="sm" onClick={this.togglePlayerState} />
                    <IconButton id="next_button" icon={<Icon icon="step-forward" />} appearance="link" size="sm" onClick={this.playNextSong} />
                </div>
                {/* Song seeking controls */}
                <div style={{flexGrow:1}} className="rs-hidden-xs">
                    <div className="song_progress_bar_container">
                        <span>{seconds_to_mss(seek)}</span>
                        <Slider className="rs-slider song_progress_bar" value={seek} onChange={this.onSeeking} onAfterChange={this.onSeekingStopped} max={song.duration || 0} />
                        <span>{seconds_to_mss(song.duration || 0)}</span>
                    </div>
                </div>
                {/* Toggle shuffle */}
                <div className="shuffle_container rs-hidden-xs">
                    <IconButton id="shuffle_button" icon={<Icon icon="random" inverse={!isShuffleOn} />} onClick={this.toggleShuffle} appearance="link" size="lg"/>
                </div>
                {/* Go to queue */}
                <div className="go_to_queue_container">
                    <IconButton id="queue_button" icon={<Icon icon="bars" />} onClick={this.goToQueueView} appearance="link" size="lg"/>
                </div>
                <div className="chromecast-icon">
                    <google-cast-launcher id="castbutton"></google-cast-launcher>
                </div>
                {/* Volume controls */}
                <div className="rs-hidden-xs">
                    <div className="volume_controls_container">
                        <IconButton id="mute" onClick={this.toggleMute} icon={<Icon className="volume_control_mute" icon={volume === 0 ? 'volume-off' : 'volume-up'} />} appearance="link" />
                        <Slider className="volume_control_bar" value={volume} onChange={this.changeVolume} defaultValue={1} max={1} step={0.05} />
                    </div>
                </div>
            </div>
        )
    }
}

MusicPlayer.propTypes = {
    playNextSong : PropTypes.func,
    playPreviousSong : PropTypes.func,
    seekToSongInQueue: PropTypes.func,
    setStarOnSongs : PropTypes.func,
    toggleShuffle : PropTypes.func,
    song : PropTypes.object,
    isShuffleOn: PropTypes.bool,
}
