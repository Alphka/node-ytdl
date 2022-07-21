export default function GetArtist(title: string, owner: string){
	function GetName(){
		if(/^[\w ]+ - [\w\W]+$/.test(title)) return title.split("-")[0]
		if(/^[\w ]+ "\w+" [\w\W]+$/.test(title)) return title.split('"')[0]

		const topicString = " - Topic"
		return owner.endsWith(topicString) ? owner.substring(0, owner.lastIndexOf(topicString)) : owner
	}

	return GetName().trim()
}
