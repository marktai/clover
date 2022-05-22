package server

import (
	"fmt"
	"github.com/gorilla/mux"
	"log"
	"math/rand"
	"net/http"
	"time"
	"marktai.com/websockets/ws"
)

var requireAuth bool

func Log(handler http.HandlerFunc) http.HandlerFunc {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		log.Printf("%s %s %s", r.RemoteAddr, r.Method, r.URL)
		handler.ServeHTTP(w, r)
	})
}

func Run(port int) {

	rand.Seed(time.Now().UTC().UnixNano())
	r := mux.NewRouter()

	r.HandleFunc("/listen/{id:[0-9a-zA-Z]+}", Log(ws.ServeWs)).Methods("GET")
	r.HandleFunc("/broadcast/{id:[0-9a-zA-Z]+}", Log(broadcastUpdate)).Methods("POST")

	for {
		log.Printf("Running at 0.0.0.0:%d\n", port)
		log.Println(http.ListenAndServe(fmt.Sprintf("0.0.0.0:%d", port), r))
		time.Sleep(1 * time.Second)
	}
}
