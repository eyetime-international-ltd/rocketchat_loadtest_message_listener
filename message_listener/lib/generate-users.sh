#! /bin/bash
###############################################################################
# Script for generation a .js file containing serveral randomly generated users
# The script can be called by executing ./generate.sh -u #users
###############################################################################

USERDATAFILE="user_insert_script.js"
USERRESOURCEFILE="userdata.js"
#declare -a BP_USERS=('blo' 'bkr' 'jre' 'jer' 'dsc' 'tka', 'tsc')

usage()
{
    echo "usage: generate #users"
}

#generate_bp_users(){
#DATE=$(date -u +"%Y-%m-%dT%H:%M:%S.%S0Z")
#echo "  { \"_id\" : \"admin\", \"createdAt\" : ISODate(\"${DATE}\"), \"services\" : { \"password\" : { \"bcrypt\" : \"\$2b\$10\$MtJgYCtnJRXG9G9CHNveJux4hQk4I6N1C69MJpUsePMcOfNyAf/2.\" } }, \"username\" : \"admin\", \"emails\" : [ { \"address\" : \"admin@user.tld\", \"verified\" : false } ], \"type\" : \"user\", \"status\" : \"offline\", \"active\" : true, \"name\" : \"admin\", \"_updatedAt\" : ISODate(\"${DATE}\"), \"roles\" : [ \"admin\" ], \"settings\" : {  } }," >> $USERDATAFILE

#for user in "${BP_USERS[@]}"; do
#  DATE=$(date -u +"%Y-%m-%dT%H:%M:%S.%S0Z")
#  echo "  { \"_id\" : \"${user}\", \"createdAt\" : ISODate(\"${DATE}\"), \"services\" : { \"password\" : { \"bcrypt\" : \"\$2b\$10\$MtJgYCtnJRXG9G9CHNveJux4hQk4I6N1C69MJpUsePMcOfNyAf/2.\" } }, \"username\" : \"${user}\", \"emails\" : [ { \"address\" : \"${user}@user.tld\", \"verified\" : false } ], \"type\" : \"user\", \"status\" : \"offline\", \"active\" : true, \"name\" : \"${user}\", \"_updatedAt\" : ISODate(\"${DATE}\"), \"roles\" : [ \"admin\" ], \"settings\" : {  } }," >> $USERDATAFILE
#  echo "  { \"_id\" : \"${user}\", \"createdAt\" : \"${DATE}\", \"services\" : { \"password\" : { \"bcrypt\" : \"\$2b\$10\$MtJgYCtnJRXG9G9CHNveJux4hQk4I6N1C69MJpUsePMcOfNyAf/2.\" } }, \"username\" : \"${user}\", \"emails\" : [ { \"address\" : \"${user}@user.tld\", \"verified\" : false } ], \"type\" : \"user\", \"status\" : \"offline\", \"active\" : true, \"name\" : \"${user}\", \"_updatedAt\" : \"${DATE}\", \"roles\" : [ \"user\" ], \"settings\" : {  } }," >> $USERRESOURCEFILE
#done
#}

file_template_start()
{
  echo -e "var users = [" > $USERDATAFILE
  echo -e "module.exports = Object.freeze({
  USERNAMES: [" > $USERRESOURCEFILE
}

file_template_stop()
{

  echo -e "]

db.rocketchat_room.remove({\"_id\" : {\$ne: \"GENERAL\"}})
db.rocketchat_message.remove({})
db.rocketchat_subscription.remove({})

db.users.insert(users)" >> $USERDATAFILE

  echo -e "  ]
})" >> $USERRESOURCEFILE
}

#### MAIN
if [ "$1" == "" ]; then
  usage
  exit
fi

file_template_start
for userid in $( apg -a 0 -x 17 -m 17 -M CL -n $1 ); do
  DATE=$(date -u +"%Y-%m-%dT%H:%M:%S.%S0Z")
  echo "  { \"_id\" : \"${userid}\", \"createdAt\" : ISODate(\"${DATE}\"), \"services\" : { \"password\" : { \"bcrypt\" : \"\$2b\$10\$MtJgYCtnJRXG9G9CHNveJux4hQk4I6N1C69MJpUsePMcOfNyAf/2.\" } }, \"username\" : \"u${userid}\", \"emails\" : [ { \"address\" : \"u${userid}@user.tld\", \"verified\" : true } ], \"type\" : \"user\", \"status\" : \"offline\", \"active\" : true, \"name\" : \"u${userid}\", \"_updatedAt\" : ISODate(\"${DATE}\"), \"roles\" : [ \"admin\" ], \"settings\" : {  } }," >> $USERDATAFILE

  echo "  \"u${userid}\"," >> $USERRESOURCEFILE
done
#generate_bp_users

sed -i '' '$ s/.$//' $USERDATAFILE
sed -i '' '$ s/.$//' $USERRESOURCEFILE
file_template_stop

