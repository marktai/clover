package server

import (
	"github.com/gorilla/mux"
	"io/ioutil"
	"log"
	"net/http"
	"marktai.com/websockets/ws"
)

func broadcastUpdate(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)

	id, ok := vars["id"]
	if !ok {
		http.Error(w, "ID not provided in URL", 400)
		return
	}

	body, err := ioutil.ReadAll(r.Body)
	if err != nil {
		log.Println(err)
		http.Error(w, "Error reading from request body", 500)
		return
	}

	err = ws.Broadcast(id, body)

	if err != nil {
		log.Println(err)
		http.Error(w, "Error broadcasting", 500)
		return
	}

  	w.WriteHeader(200)
}
